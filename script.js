// Simple, transparent "AI" = deterministic scoring function + light NLP heuristics.

    const STORAGE_KEY = 'ai_prior_tasks_v1';

    let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');



    // Default weights (configurable in UI)

    function getWeights(){

      return {

        imp: parseFloat(document.getElementById('wImportance').value),

        urg: parseFloat(document.getElementById('wUrgency').value),

        eff: parseFloat(document.getElementById('wEffort').value)

      }

    }



    function updateWeights(){

      // show live values near sliders (simple approach: browser shows numeric input's value next to knobs already)

      // but re-render priority to reflect new weights

      renderTasks();

    }



    function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }



    function addTask(task){ tasks.push(task); save(); renderTasks(); }



    function parseSmartSuggestion(title, desc){

      // basic NLP-ish heuristics

      const text = (title + ' ' + desc).toLowerCase();

      let importance = 5, urgency = 4, effort = 1;

      if(/urgent|asap|immediately|today|now/.test(text)) urgency = Math.max(urgency, 9);

      if(/important|must|priority|critical|high impact/.test(text)) importance = Math.max(importance, 9);

      const dueInMatch = text.match(/due in (\d+) (day|days|week|weeks)/);

      if(dueInMatch){

        const n = parseInt(dueInMatch[1],10);

        if(/week/.test(dueInMatch[2])){

          urgency = Math.max(urgency, Math.max(0, 10 - n*2));

        } else {

          urgency = Math.max(urgency, Math.max(0, 10 - n));

        }

      }

      const hoursMatch = text.match(/(\d+(?:\.\d+)?)h|hours?/);

      if(hoursMatch) effort = parseFloat(hoursMatch[1] || hoursMatch[0]) || effort;



      // keywords reducing priority

      if(/later|someday|whenever|low priority|nice to have/.test(text)) importance = Math.min(importance,3);



      return {importance, urgency, effort};

    }



    function calculateScore(t){

      const w = getWeights();

      // due date factor: tasks due sooner get higher urgency bonus

      let dueBonus = 0;

      if(t.due){

        const now = new Date();

        const due = new Date(t.due + 'T23:59:59');

        const diffDays = Math.ceil((due - now)/(1000*60*60*24));

        // exponential-ish bonus for tight deadlines

        dueBonus = Math.max(0, 3 - (diffDays/3));

      }

      // basic linear scoring

      const raw = (w.imp * t.importance) + (w.urg * (t.urgency + dueBonus)) - (w.eff * t.effort);

      // normalize to 0..100-ish for display (not a strict scale)

      return Math.round((raw + 10) * 4);

    }



    function scoreLabel(score){

      if(score >= 60) return 'high';

      if(score >= 40) return 'med';

      return 'low';

    }



    function renderTasks(){

      const container = document.getElementById('taskList');

      container.innerHTML = '';



      // compute scores

      tasks.forEach(t => t.score = calculateScore(t));

      // sort by score desc

      tasks.sort((a,b)=>b.score - a.score);



      let high=0, med=0, low=0;

      tasks.forEach((t, idx)=>{

        const div = document.createElement('div'); div.className='task';

        const meta = document.createElement('div'); meta.className='meta';

        const h = document.createElement('h3'); h.textContent = t.title; meta.appendChild(h);

        const p = document.createElement('p'); p.textContent = t.desc || '—'; meta.appendChild(p);

        const tags = document.createElement('div'); tags.className='tags';

        const cat = document.createElement('span'); cat.className='chip'; cat.textContent = t.category||'General'; tags.appendChild(cat);

        if(t.due){ const d = document.createElement('span'); d.className='chip'; d.textContent = 'Due: '+t.due; tags.appendChild(d); }

        const info = document.createElement('span'); info.className='chip'; info.textContent = `Effort: ${t.effort}h`; tags.appendChild(info);

        meta.appendChild(tags);



        const right = document.createElement('div'); right.style.textAlign='right';

        const scoreEl = document.createElement('div'); scoreEl.className='score '+scoreLabel(t.score);

        scoreEl.textContent = t.score;

        right.appendChild(scoreEl);



        // controls

        const ctrl = document.createElement('div'); ctrl.style.marginTop='8px'; ctrl.style.display='flex'; ctrl.style.gap='6px'; ctrl.style.justifyContent='flex-end';

        const up = document.createElement('button'); up.className='btn secondary'; up.textContent='Up'; up.onclick = ()=>{moveTask(idx, idx-1)};

        const down = document.createElement('button'); down.className='btn secondary'; down.textContent='Down'; down.onclick = ()=>{moveTask(idx, idx+1)};

        const del = document.createElement('button'); del.className='btn'; del.textContent='Delete'; del.onclick = ()=>{if(confirm('Delete this task?')){tasks.splice(idx,1);save();renderTasks();}};

        ctrl.appendChild(up); ctrl.appendChild(down); ctrl.appendChild(del);

        right.appendChild(ctrl);



        div.appendChild(meta); div.appendChild(right);

        container.appendChild(div);



        if(scoreLabel(t.score)==='high') high++; else if(scoreLabel(t.score)==='med') med++; else low++;

      });



      document.getElementById('counts').textContent = tasks.length + ' tasks';

      document.getElementById('highCount').textContent = 'High: ' + high;

      document.getElementById('medCount').textContent = 'Medium: ' + med;

      document.getElementById('lowCount').textContent = 'Low: ' + low;



      save();

    }



    function moveTask(from, to){

      if(to<0 || to>=tasks.length) return;

      const [item] = tasks.splice(from,1);

      tasks.splice(to,0,item);

      save(); renderTasks();

    }



    // generate a one-day planning block based on sorted tasks and their effort

    function generatePlan(){

      if(tasks.length===0) return 'No tasks to plan.';

      const dailyHours = 8; // simple assumption

      let out = '';

      let day = 1; let remaining = dailyHours;

      tasks.forEach((t)=>{

        if(t.effort <= remaining){

          out += `Day ${day}: ${t.title} (${t.effort}h) — score ${t.score}\n`;

          remaining -= t.effort;

        } else {

          // split across days or move to next day

          out += `Day ${day}: ${t.title} (${Math.min(remaining,t.effort)}h) — part\n`;

          const left = t.effort - remaining;

          day++;

          remaining = dailyHours;

          out += `Day ${day}: ${t.title} (${left.toFixed(2)}h) — continue\n`;

          remaining -= left;

        }

        if(remaining <= 0){ day++; remaining = dailyHours; }

      });

      return out.replace(/\n/g,'<br>');

    }



    // UI handlers

    document.getElementById('taskForm').addEventListener('submit', (e)=>{

      e.preventDefault();

      const t = {

        id: Date.now(),

        title: document.getElementById('title').value.trim(),

        desc: document.getElementById('desc').value.trim(),
        due: document.getElementById('due').value || null,

        importance: Number(document.getElementById('importance').value),

        urgency: Number(document.getElementById('urgency').value),

        effort: Number(document.getElementById('effort').value) || 1,

        category: document.getElementById('category').value

      };

      addTask(t);

      document.getElementById('taskForm').reset();

      // reset sliders display values

      document.querySelector('#taskForm input[type=range]').dispatchEvent(new Event('input'));

    });



    document.getElementById('suggestBtn').addEventListener('click', ()=>{

      const title = document.getElementById('title').value;

      const desc = document.getElementById('desc').value;

      if(!title && !desc){ alert('Type a title or description for Smart Suggest'); return; }

      const s = parseSmartSuggestion(title, desc);

      document.getElementById('importance').value = s.importance;

      document.getElementById('urgency').value = s.urgency;

      document.getElementById('effort').value = s.effort;

      // reflect numeric displays

      document.querySelectorAll('#taskForm input[type=range]').forEach(r=>r.dispatchEvent(new Event('input')));

      alert('Smart Suggest applied sliders. Add the task to save it.');

    });



    document.getElementById('autoPrioritize').addEventListener('click', ()=>{

      if(tasks.length===0){ alert('No tasks to prioritize'); return; }

      renderTasks();

      document.getElementById('planArea').innerHTML = generatePlan();

    });



    document.getElementById('clearAll').addEventListener('click', ()=>{

      if(confirm('Remove all tasks?')){ tasks=[]; save(); renderTasks(); document.getElementById('planArea').textContent='No plan yet — click Auto‑Prioritize.' }

    });



    // initialize

    renderTasks();