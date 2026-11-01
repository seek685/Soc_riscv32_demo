import { headAt, candidates, filterCandidates } from './dense-head-model.js';
import { sigmoidLookup } from './model.js';

const $ = s => document.querySelector(s);
const names = ['L','T','R','B'];
const colors = ['#c76d51','#598ca8','#8a79ab','#4b9380'];
const stages = ['32 个特征 → 4 个数','4 张图 → 3600 组','对齐分类分数','筛选完整候选框'];
const number = v => Number.isInteger(v) ? String(v) : v.toFixed(2);
const atStage = progress => Math.min(3,Math.floor(progress/25));
let tableKey = '';

export function predictionControls(state) {
  const h=headAt(state.predictionId);
  return `<div class="control-heading">从通道到候选，一次走完整</div><div class="prediction-stages">${stages.map((s,i)=>`<button data-prediction-stage="${i}">${i+1}. ${s}</button>`).join('')}</div>
    <div class="control-group"><label for="prediction-example">选一个空间位置</label><select id="prediction-example">${candidates.map(c=>`<option value="${c.id}" ${c.id===state.predictionId?'selected':''}>${c.id} · 网格 (${c.grid.join(', ')})</option>`).join('')}</select></div>
    <div class="prediction-feature-controls"><div class="control-group"><label for="prediction-channel">观察输入通道 <output id="prediction-channel-value">${state.predictionChannel}</output></label><input id="prediction-channel" type="range" min="0" max="31" value="${state.predictionChannel}"></div><div class="control-group"><label for="prediction-feature">修改这个特征值 <output id="prediction-feature-value">${state.predictionFeature??h.features[state.predictionChannel]}</output></label><input id="prediction-feature" type="range" min="0" max="32" value="${state.predictionFeature??h.features[state.predictionChannel]}"></div><button id="prediction-restore" class="wide-button">恢复这个位置的原始教学值</button></div>
    <div class="prediction-filter-controls"><div class="control-group"><label for="prediction-threshold">分类分数阈值 <output id="prediction-threshold-value">${state.predictionThreshold}</output></label><input id="prediction-threshold" type="range" min="0" max="255" value="${state.predictionThreshold}"></div><label class="checks"><input id="prediction-replace" type="checkbox" ${state.predictionReplace?'checked':''}> 时序允许替换旧框</label></div>
    <div class="metric"><small>当前位置的一组 L / T / R / B</small><strong id="prediction-ltrb"></strong></div><div class="metric"><small id="prediction-result-label">四个数来自共同输入</small><strong id="prediction-result"></strong></div>
    <p id="prediction-note" class="control-note"></p><p class="control-note">A–E 是五组人工特征与示例权重，不是实际模型推理；特征不等于坐标输入。第 1 步省略定点缩放、舍入及饱和，显示教学加权和，调整后可能超出硬件 −256…255 的范围。真实量化可在 L7 展开图中查看。</p>`;
}

export function bindPredictionControls(state, redraw) {
  const stop=()=>{state.playing=false;$('#play').textContent='▶ 播放';$('#play').setAttribute('aria-pressed','false');};
  document.querySelectorAll('[data-prediction-stage]').forEach(b=>b.onclick=()=>{
    stop();state.progress=+b.dataset.predictionStage*25;redraw();
  });
  const refreshFeature=()=>{
    const h=headAt(state.predictionId);state.predictionFeature=null;
    $('#prediction-feature').value=h.features[state.predictionChannel];
    $('#prediction-feature-value').textContent=h.features[state.predictionChannel];
  };
  $('#prediction-example').onchange=e=>{state.predictionId=e.target.value;refreshFeature();redraw();};
  $('#prediction-channel').oninput=e=>{state.predictionChannel=+e.target.value;$('#prediction-channel-value').textContent=e.target.value;refreshFeature();redraw();};
  $('#prediction-feature').oninput=e=>{state.predictionFeature=+e.target.value;$('#prediction-feature-value').textContent=e.target.value;redraw();};
  $('#prediction-restore').onclick=()=>{refreshFeature();redraw();};
  $('#prediction-threshold').oninput=e=>{state.predictionThreshold=+e.target.value;$('#prediction-threshold-value').textContent=e.target.value;redraw();};
  $('#prediction-replace').onchange=e=>{state.predictionReplace=e.target.checked;redraw();};
}

function updateProducts(h, stage) {
  const detail=$('#prediction-products');detail.hidden=stage!==0;
  const key=JSON.stringify([h.id,h.features]);
  if(key===tableKey)return;
  tableKey=key;
  $('#prediction-products-body').innerHTML=h.features.map((f,c)=>`<tr><th scope="row">f${c}</th><td>${f}</td>${names.map((_,j)=>`<td>${f} × ${h.weights[j][c]} = <b>${number(h.products[j][c])}</b></td>`).join('')}</tr>`).join('');
  $('#prediction-products-foot').innerHTML=`<tr><th colspan="2">全部 32 项之和</th>${h.sums.map(v=>`<td>${number(v)}</td>`).join('')}</tr><tr><th colspan="2">加各自偏置</th>${h.biases.map(v=>`<td>${number(v)}</td>`).join('')}</tr><tr><th colspan="2">一组完整 LTRB</th>${h.values.map(v=>`<td><b>${number(v)}</b></td>`).join('')}</tr>`;
}

export function drawPredictions(state, g) {
  const {ctx,text,rect,line,arrow,circle,write}=g;
  const stage=atStage(state.progress), local=Math.min(1,(state.progress-stage*25)/25);
  const base=headAt(state.predictionId);
  // Editing is deliberately confined to the weighted-sum experiment, not silently
  // mixed with the five fixed candidate fixtures in the following steps.
  const h=stage===0&&state.predictionFeature!==null?headAt(state.predictionId,{channel:state.predictionChannel,value:state.predictionFeature}):base;
  document.querySelectorAll('[data-prediction-stage]').forEach(b=>{b.classList.toggle('active',+b.dataset.predictionStage===stage);b.setAttribute('aria-pressed',String(+b.dataset.predictionStage===stage));});
  $('.prediction-feature-controls').hidden=stage!==0;
  $('.prediction-filter-controls').hidden=stage!==3;
  write('visual-name',`第 ${stage+1} 步 · ${stages[stage]}`);
  write('prediction-ltrb',h.values.map(number).join(' / '));
  updateProducts(h,stage);
  const title=(a,b)=>{text(a,32,32,18);text(b,32,61,12,'#78868e');};

  if(stage===0){
    title('一个位置有 32 个特征，四套权重把它们组合成四个数。','每个输入只是贡献一项乘积；这里没有 32 组框，也没有 argmax。');
    text(`L6 · 网格 (${h.grid.join(', ')})`,135,99,13,'#687a83','center');
    const count=Math.min(32,Math.floor(local*33));
    h.features.forEach((v,c)=>{
      const x=32+(c%4)*54,y=125+Math.floor(c/4)*36,selected=c===state.predictionChannel;
      rect(x,y,47,29,selected?'#ffe4d6':c<count?'#e1ebf0':'#f0f3f5',selected?'#c76d51':'#dbe2e7',3);
      text(`f${c}`,x+4,y+8,8,'#81919a');text(number(v),x+25,y+18,13,'#35454e','center','monospace');
    });
    const sx=32+(state.predictionChannel%4)*54+47,sy=125+Math.floor(state.predictionChannel/4)*36+15;
    names.forEach((name,j)=>{
      const y=132+j*86;
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.bezierCurveTo(285,sy,284,y+14,324,y+14);ctx.strokeStyle=colors[j];ctx.globalAlpha=.48;ctx.lineWidth=1.5;ctx.stroke();ctx.globalAlpha=1;
      text(`${name} 的 32 项`,329,y-21,12,colors[j]);
      h.products[j].forEach((v,c)=>{const xx=329+(c%8)*19,yy=y-8+Math.floor(c/8)*12;rect(xx,yy,16,9,c===state.predictionChannel?colors[j]:c<count?'#c5d5de':'#e9eef1',null,1);});
      text(`f${state.predictionChannel} × ${h.weights[j][state.predictionChannel]} = ${number(h.products[j][state.predictionChannel])}`,502,y+7,12,colors[j],'left','monospace');
      text(`已累加 ${count} 项 = ${number(h.products[j].slice(0,count).reduce((a,b)=>a+b,0))}`,502,y+28,10,'#7d8990','left','monospace');
      arrow(660,y+15,694,y+15,colors[j]);
      text(`Σ=${h.sums[j]}，b=${h.biases[j]}`,704,y-6,11,'#7b888e');
      rect(704,y+6,155,42,'#f7f9fa',colors[j],4);text(`${name} = ${number(h.values[j])}`,781,y+28,22,colors[j],'center','monospace');
    });
    text(`逐项累加：${count} / 32（右侧显示全部相加后的教学值）`,450,457,12,'#7b888e','center');
    text('32 个输入全部使用 → 4 次独立求和 → 1 组 LTRB',450,488,16,'#b75f48','center');
    write('prediction-result-label',`f${state.predictionChannel} 同时参与四个输出`);
    write('prediction-result','加权求和，不取最大值');
    write('prediction-note','修改一个特征值，观察四个距离分别如何变化。下方可展开全部 32×4 个乘积核对。修改仅作用于本步骤，后面使用固定 A–E 示例。');
    write('visual-caption','不同输出有各自的 32 个权重和一个偏置；换空间位置时权重不变，输入特征变了。');
  }

  if(stage===1){
    title('“4 个有效输出”是 4 张 80×45 的图。','从四张图的同一个地址各取一个数，才组成该位置的一组 LTRB。');
    names.forEach((name,j)=>{
      const x=30+j*220,y=143,w=180,height=101.25;
      text(`${name} 图 · 80 × 45`,x+w/2,111,16,colors[j],'center');
      for(let yy=0;yy<45;yy++)for(let xx=0;xx<80;xx++)rect(x+xx*w/80,y+yy*height/45,w/80-.35,height/45-.35,'#dfe7eb');
      candidates.forEach(c=>circle(x+(c.grid[0]+.5)*w/80,y+(c.grid[1]+.5)*height/45,2,'#a2b1b9'));
      const px=x+(h.grid[0]+.5)*w/80,py=y+(h.grid[1]+.5)*height/45;
      line(px,y,px,y+height,colors[j],1);line(x,py,x+w,py,colors[j],1);rect(px-4,py-4,8,8,'#fff',colors[j]);
      text(`${name}[${h.grid.join(', ')}] = ${number(h.values[j])}`,x+w/2,275,15,colors[j],'center','monospace');
      arrow(x+w/2,294,450,321,colors[j]);
    });
    text(`候选 ${h.id} 的一组：${h.values.join(' / ')}`,450,337,18,'#b6664f','center');
    ['A','B'].forEach((id,i)=>{
      const example=headAt(id),x=30+i*440;
      rect(x,360,420,99,id===h.id?'#fff3eb':'#f3f7f9',id===h.id?'#dfad95':'#dbe4e8',5);
      text(`${id} · 参考点 (${example.box.cx},${example.box.cy})`,x+15,380,13,'#687f8b');
      text(`左边：${example.box.cx} − 2×${example.values[0]} = 400`,x+15,405,14,colors[0],'left','monospace');
      text(`右边：${example.box.cx} + 2×${example.values[2]} = 592`,x+15,431,14,colors[2],'left','monospace');
      text('同一个框',x+350,406,12,'#538d80','center');
    });
    text('4 张图 × 3600 个位置 → 3600 组候选；相邻位置可以指向同一个框。',450,485,15,'#374954','center');
    write('prediction-result-label','输出张量中的两种数量');write('prediction-result','4 通道 · 3600 个位置');
    write('prediction-note','选择 A 与 B：它们的 L / R 不同，但解码的原始框相同。图中灰格只表示空间位置，没有伪造其余 3595 个位置的真实推理值。');
    write('visual-caption','16 是硬件槽位数，4 才是 L/T/R/B 的有效语义通道数；不存在从 16 组框中选 4 组的步骤。');
  }

  if(stage===2){
    title('类别与框按同一个网格地址配对。','argmax 用在分类分支的 5 个类别分数上，不在 L7 的四个距离上。');
    rect(35,103,395,115,'#fff3ed','#e6b5a2',5);text('L7 框分支：4 个数全部保留',56,129,16,colors[0]);
    names.forEach((n,j)=>text(`${n}=${h.values[j]}`,60+j*91,174,18,colors[j],'left','monospace'));
    text('没有 argmax，也不把四个距离排序',56,202,12,'#96745f');
    text('L10 类别分支：在 5 个原始分数中取最大',35,251,14,'#557f94');
    const considered=Math.min(5,1+Math.floor(local*5));
    let running=0;for(let i=1;i<considered;i++)if(h.scores[i]>h.scores[running])running=i;
    h.scores.forEach((z,i)=>{
      const yy=284+i*32,active=i<considered;
      text(`类别 ${i}`,45,yy,12,'#7b888e');rect(110,yy-10,200,20,'#eef3f5',null,2);
      rect(110,yy-10,sigmoidLookup(z)/255*200,20,active&&i===running?'#649bb4':'#bfd0d9',null,2);
      text(`z=${z}`,325,yy,12,active?'#314954':'#adbac1','left','monospace');
    });
    arrow(435,162,546,239,colors[0]);arrow(435,359,546,285,colors[1]);
    rect(558,178,310,202,'#f7f9fa','#cdd8de',6);text(`同一位置 (${h.grid.join(', ')})`,578,204,15);
    text(`完整框：(${h.box.x1},${h.box.y1})`,578,246,15,colors[0]);text(`→ (${h.box.x2},${h.box.y2})`,578,272,15,colors[0]);
    text(`胜出类别 ${h.classId} · 分数 ${h.confidence}/255`,578,316,14,colors[1]);text('网格地址是两路结果的配对依据',578,351,12,'#7b888e');
    text(`当前比较 ${considered}/5 类；最终 argmax → 类别 ${h.classId} → sigmoid 查表`,450,480,14,'#557f94','center');
    write('prediction-result-label','配对后的候选');write('prediction-result',`${h.id} · 类别 ${h.classId} · ${h.confidence}/255`);
    write('prediction-note','分类的最大值只决定“这个位置最支持哪一类”和对应分数，不能替代这一个位置的四个距离。类别分数与距离来自不同分支。');
    write('visual-caption','条长为查表分数，仅辅助阅读；硬件先比较有符号原始值，再对胜出值查表。');
  }

  if(stage===3){
    title('后处理筛选的是完整候选框，不是最大的 L、T、R、B。','按 A → B → C → D → E 到达：先过分类阈值，再检查同类重叠。');
    const processed=Math.min(5,Math.floor(local*5+1e-6));
    const result=filterCandidates(state.predictionThreshold,state.predictionReplace,processed);
    const status=new Map(result.rows.map(r=>[r.id,r]));
    rect(30,122,410,231,'#e7eff3','#ccd8df');rect(30,230,410,123,'#d9e3e8');
    const sx=410/1280,sy=231/720;
    for(const id of ['A','D']){const b=candidates.find(c=>c.id===id).box;rect(30+b.x1*sx,122+b.y1*sy,(b.x2-b.x1)*sx,(b.y2-b.y1)*sy,'#7094a9',null,2);}
    candidates.forEach(c=>{
      const row=status.get(c.id);if(!row)return;
      const kept=row.status==='kept',b=c.box;
      ctx.strokeStyle=kept?(c.id==='E'?'#8a79ab':'#418d79'):'#a7b2b8';ctx.lineWidth=kept?2.5:1;ctx.setLineDash(kept?[]:[4,3]);ctx.strokeRect(30+b.x1*sx,122+b.y1*sy,(b.x2-b.x1)*sx,(b.y2-b.y1)*sy);ctx.setLineDash([]);
      const labelOffset=c.id==='B'?24:c.id==='E'?38:10;
      text(c.id,30+b.x1*sx+4,122+b.y1*sy-labelOffset,12,kept?(c.id==='E'?'#8a79ab':'#418d79'):'#8c9ba4');
    });
    text('绿 / 紫：当前保留；灰虚线：已过滤或被替换',35,381,11,'#72838d');
    text('候选',470,112,11,'#7b888e');text('类别 / 分数',533,112,11,'#7b888e');text('处理结果',669,112,11,'#7b888e');
    const labels={'kept':'保留','replaced':'被高分框替换','low-score':'低分过滤','duplicate':'重复，不替换'};
    candidates.forEach((c,i)=>{
      const yy=145+i*57,r=status.get(c.id);rect(459,yy-18,416,49,r?.status==='kept'?'#eff6f2':'#f3f6f7',null,3);
      text(`${c.id} (${c.grid.join(',')})`,470,yy,12);text(`${c.classId} / ${c.score}`,588,yy,13,'#6d818e','center','monospace');
      text(r?labels[r.status]:'等待到达',669,yy,12,r?.status==='kept'?'#418d79':'#8a959c');
      if(r?.against)text(`与 ${r.against} 比较`,669,yy+17,9,'#8a959c');
    });
    rect(35,413,400,65,'#fff5ef','#eed3c3',4);text('C 的距离更大，但分类分数只有 47。',49,435,13,'#b56e50');text('D 是另一目标；E 与 A / B 类别不同。',49,459,11,'#7b888e');
    text(`已处理 ${processed}/5 · 当前保留 ${result.kept.map(c=>c.id).join('、')||'无'}`,671,466,16,'#418d79','center');
    write('prediction-result-label',`已处理 ${processed} / 5 个候选`);write('prediction-result',result.kept.map(c=>c.id).join('、')||(processed===0?'等待候选':processed===5?'无候选保留':'暂无候选保留'));
    write('prediction-note',(result.rows.length?`刚处理 ${result.rows.at(-1).id}：${result.rows.at(-1).reason} `:'播放或拖动进度，观察五个候选依次到达。 ')+'同类 IoU≥0.5 才判重复；新分数更高且时序允许才替换。这里只占用最多六槽中的少数槽，未重现帧新鲜度等完整硬件控制。');
    write('visual-caption','IoU 比较使用加余量后的区域，图中保留原始框便于对照；不会把不同位置的最大距离拼接成新框。');
  }
}
