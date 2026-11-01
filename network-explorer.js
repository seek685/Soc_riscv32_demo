import { layers } from './model.js';
import { createExample, inspectPixel } from './explorer-model.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const sourceOf = id => id === 0 ? 'input' : id === 8 ? 4 : id - 1;
const useful = layer => layer.usefulChannels || layer.channels;
const ink = '#3c4850';
const coral = '#d4745e';
const clamp = (v, max) => Math.max(0, Math.min(max, v));
function color(value, scale = 255) {
  const t = Math.min(1, Math.abs(value) / Math.max(1, scale));
  const end = value < 0 ? [83,145,176] : [215,118,94];
  return `rgb(${end.map(c => Math.round(249 + (c - 249) * t)).join(',')})`;
}
function extent(data) { return Math.max(1, ...data.flat().map(Math.abs)); }
function paint(canvas, data, { scale = extent(data), cell, window, rgbChannel } = {}) {
  const g = canvas.getContext('2d'), h = data.length, w = data[0].length;
  const cw = canvas.width / w, ch = canvas.height / h;
  g.clearRect(0, 0, canvas.width, canvas.height);
  data.forEach((row,y) => row.forEach((v,x) => {
    g.fillStyle = rgbChannel === undefined ? color(v,scale) : `rgb(${[0,1,2].map(c => c === rgbChannel ? v : Math.round(v * .18)).join(',')})`;
    g.fillRect(x*cw,y*ch,cw+.2,ch+.2);
  }));
  if (window) {
    g.fillStyle = '#eaa85728'; g.fillRect(window.x*cw,window.y*ch,window.size*cw,window.size*ch);
    g.strokeStyle = '#c76843'; g.lineWidth = 3;
    g.strokeRect(window.x*cw,window.y*ch,window.size*cw,window.size*ch);
  }
  if (cell) {
    g.strokeStyle = coral; g.lineWidth = 3;
    g.strokeRect(cell.x*cw+.5,cell.y*ch+.5,cw-1,ch-1);
  }
  canvas.dataset.cols = w; canvas.dataset.rows = h;
}
const thumbnail = (id, ch) => `<button class="feature-tile" data-output="${ch}" aria-label="展开 L${id} 输出通道 ${ch}"><canvas width="160" height="90"></canvas></button>`;
const positions = [{id:'input',x:18,y:134},...Array.from({length:5},(_,id)=>({id,x:185+id*130,y:64})),...Array.from({length:6},(_,j)=>({id:j+5,x:865+j%3*120,y:j<3?32:226}))];

export function createNetworkExplorer({ getSample, onSelectLayer, drawInput }) {
  let opened = false, selectedLayer = 0, outputChannel = 0, inputChannel = 0, page = 0;
  let x = 7, y = 4, details = false, scanning = false, scanTimer = null, example;
  let previousFocus;
  const container = $('#network-overview');
  const expanded = $('#layer-expanded');

  function highlight(id, channel) {
    const source = sourceOf(id);
    $$('#connections .network-link').forEach(path => path.classList.toggle('active',path.dataset.to === String(id) && +path.dataset.output === channel));
    $$('.node').forEach(n => {
      n.classList.toggle('dependency',n.dataset.node === String(source));
      n.classList.toggle('hovered',n.dataset.node === String(id));
    });
  }
  function clearHighlight() {
    $$('#connections .active').forEach(p=>p.classList.remove('active'));
    $$('.node').forEach(n=>n.classList.remove('dependency','hovered'));
  }
  function renderOverview() {
    $('#network-nodes').innerHTML = positions.map(p => {
      if(p.id === 'input')return `<div class="node input" style="left:${p.x}px;top:${p.y}px" data-node="input"><span class="node-title">输入图像</span><canvas width="240" height="136"></canvas><span class="node-shape">1280 × 720 × 3</span><span class="node-op">RGB 三个通道</span></div>`;
      const l=layers[p.id], count=p.id<5?4:2;
      return `<div class="node" style="left:${p.x}px;top:${p.y}px" data-node="${p.id}"><button class="layer-label" aria-label="展开 L${p.id}"><span class="node-title">L${p.id}</span><span class="node-shape">${l.width}×${l.height}×${l.channels}</span><span class="node-op">${l.kernel}×${l.kernel} / s${l.stride}${l.relu?' · ReLU':''}</span></button>${Array.from({length:count},(_,i)=>thumbnail(p.id,i)).join('')}<span class="node-more">${l.usefulChannels?`${l.usefulChannels} 个有效输出`:`… ${l.channels} 个通道`}</span></div>`;
    }).join('') + '<div class="terminal" style="top:77px;color:var(--coral)"><strong>L T R B</strong><small>4 个距离 → 原图坐标</small><button data-expand-head="7">展开框头 ↗</button></div><div class="terminal" style="top:267px;color:var(--blue)"><strong>0 ··· 4</strong><small>5 个类别 → 分数</small><button data-expand-head="10">展开分类头 ↗</button></div>';
    let paths='';
    for(const q of positions.filter(p=>p.id!=='input')) {
      const source=sourceOf(q.id),p=positions.find(p=>p.id===source),count=source==='input'?1:source<5?4:2;
      for(let i=0;i<count;i++)for(let j=0;j<(q.id<5?4:2);j++){
        const xs=p.x+(source==='input'?126:74), xe=q.x+14, ys=p.y+(source==='input'?62:76+i*37),ye=q.y+76+j*37;
        paths+=`<path class="network-link" data-from="${source}" data-to="${q.id}" data-output="${j}" d="M${xs},${ys} C${(xs+xe)/2},${ys} ${(xs+xe)/2},${ye} ${xe},${ye}"/>`;
      }
    }
    $('#connections').innerHTML=paths;
    drawInput($('.node.input canvas'));
    $$('.node:not(.input)').forEach(node=>{
      const id=+node.dataset.node;
      node.querySelector('.layer-label').onclick=()=>open(id,0);
      node.querySelectorAll('.feature-tile').forEach(tile=>{
        const ch=+tile.dataset.output;
        paint(tile.querySelector('canvas'),createExample(id,ch,getSample()).output);
        tile.onpointerenter=tile.onfocus=()=>highlight(id,ch);
        tile.onpointerleave=tile.onblur=clearHighlight;
        tile.onclick=()=>open(id,ch);
      });
    });
    $$('[data-expand-head]').forEach(b=>b.onclick=()=>open(+b.dataset.expandHead,0));
  }
  function stopScan() {
    scanning=false;clearInterval(scanTimer);scanTimer=null;
    if($('#scan-window')){$('#scan-window').textContent='扫描卷积窗口';$('#scan-window').setAttribute('aria-pressed','false');}
  }
  function open(id, channel=0) {
    stopScan();previousFocus=document.activeElement;opened=true;selectedLayer=id;outputChannel=channel;inputChannel=0;page=0;details=false;
    container.hidden=true;expanded.hidden=false;
    onSelectLayer(id,channel);
    renderExpanded();
    $('#expanded-layer').focus({preventScroll:true});
  }
  function close() {
    stopScan();opened=false;details=false;expanded.hidden=true;container.hidden=false;clearHighlight();
    const focusTarget=previousFocus?.isConnected?previousFocus:document.querySelector(`.node[data-node="${selectedLayer}"] .feature-tile[data-output="${outputChannel}"]`)||document.querySelector(`.node[data-node="${selectedLayer}"] .layer-label`);
    focusTarget?.focus({preventScroll:true});
  }
  function loadExample() {
    example=createExample(selectedLayer,outputChannel,getSample());
    x=clamp(x,example.width-1);y=clamp(y,example.height-1);
  }
  function rowHTML(channel) {
    const label=example.sourceId==='input'?['R · 红通道','G · 绿通道','B · 蓝通道'][channel]:`输入通道 ${channel}`;
    return `<button class="source-row" data-input-row="${channel}" style="top:${84+(channel-page*3)*132}px" aria-label="放大输入通道 ${channel} 的逐项计算"><span class="source-name">${label}</span><canvas class="source-map" width="320" height="180" aria-label="${label}，移动指针选择窗口"></canvas><span class="row-times">×</span><span class="kernel-matrix" style="--kernel:${example.layer.kernel}">${example.kernels[channel].flat().map(v=>`<span style="background:${color(v,4)}">${v}</span>`).join('')}</span><span class="row-arrow">→</span><canvas class="contribution-map" width="320" height="180" aria-label="本通道卷积结果"></canvas><span class="row-value"></span></button>`;
  }
  function renderExpanded() {
    loadExample();
    const l=example.layer,source=example.sourceId==='input'?'RGB 输入':`L${example.sourceId}`, count=example.inputs.length;
    expanded.innerHTML=`<div class="expanded-toolbar"><button id="return-network">← 返回全网</button><div class="expanded-title"><b>展开 <label><span class="sr-only">卷积层</span><select id="expanded-layer">${layers.map(l=>`<option value="${l.id}" ${l.id===selectedLayer?'selected':''}>L${l.id}</option>`).join('')}</select></label></b><span id="expanded-source">${source} → L${selectedLayer}</span></div><label>输出通道 <select id="expanded-output-channel">${Array.from({length:useful(l)},(_,i)=>`<option value="${i}" ${i===outputChannel?'selected':''}>${i}${l.id===7?' · '+['L','T','R','B'][i]:l.id===10?' · 类别 '+i:''}</option>`).join('')}</select></label><button id="scan-window" aria-pressed="false">扫描卷积窗口</button></div><p class="expanded-instruction">移动到图中某个像素，查看它对应的窗口；点击一行放大乘加。<span>${l.kernel}×${l.kernel} 卷积 · stride ${l.stride} · ${count} 个输入通道</span></p><div class="expanded-scroll"><div class="expanded-diagram"><div class="column-caption input-caption">${source} 的输入特征</div><div class="column-caption kernel-caption">卷积核</div><div class="column-caption contribution-caption">每个通道的卷积结果</div><svg id="expanded-links" viewBox="0 0 1120 515" aria-hidden="true"></svg><div id="source-rows">${Array.from({length:Math.min(3,count-page*3)},(_,i)=>rowHTML(page*3+i)).join('')}</div><div class="bias-node" title="偏置只在所有通道汇总后加一次">偏置 b<strong>${example.bias}</strong></div><div class="sum-node">+</div><div class="sum-note">汇总全部 ${count} 个通道<strong id="expanded-total"></strong></div><div class="output-operation">÷ 2<sup>${example.shift}</sup> · 舍入 · ${l.relu?'ReLU / 饱和':'有符号饱和'}<small>${l.relu?'0…255':'−256…255'}</small></div><div id="expanded-output"><span>L${selectedLayer} · 输出通道 ${outputChannel}</span><canvas width="384" height="216" tabindex="0" aria-label="输出特征图：移动鼠标、点击或方向键选择像素"></canvas><strong id="expanded-code"></strong><small>位置 <b id="pixel-address"></b></small></div><p class="diagram-hint">一行只贡献一部分。所有输入通道相加，加一次偏置，才得到选中输出通道。</p></div></div><div class="source-pagination"><button id="source-page-prev" ${page===0?'disabled':''}>← 上一组</button><span>输入 ${page*3}–${Math.min(count-1,page*3+2)} / 共 ${count} 个<span class="pagination-note"> · 未显示的通道也全部参与求和</span></span><button id="source-page-next" ${(page+1)*3>=count?'disabled':''}>下一组 →</button></div><p class="teaching-slice">放大图使用 32×18 教学切片及示例权重，输出为 ${example.width}×${example.height}；真实层输出为 ${l.width}×${l.height}×${l.channels}。层间教学切片独立生成，不是训练模型的逐层推理。</p><section id="pixel-inspector" ${details?'':'hidden'} aria-label="放大的像素计算"></section>`;
    $('#return-network').onclick=close;
    $('#expanded-layer').onchange=e=>{stopScan();selectedLayer=+e.target.value;outputChannel=0;inputChannel=0;page=0;onSelectLayer(selectedLayer,0);renderExpanded();$('#expanded-layer').focus({preventScroll:true});};
    $('#expanded-output-channel').onchange=e=>{stopScan();outputChannel=+e.target.value;onSelectLayer(selectedLayer,outputChannel);renderExpanded();$('#expanded-output-channel').focus({preventScroll:true});};
    $('#source-page-prev').onclick=()=>changePage(-1);
    $('#source-page-next').onclick=()=>changePage(1);
    $('#scan-window').onclick=()=>{
      if(scanning){stopScan();return;}
      scanning=true;$('#scan-window').textContent='暂停窗口扫描';$('#scan-window').setAttribute('aria-pressed','true');
      scanTimer=setInterval(()=>{x++;if(x>=example.width){x=0;y=(y+1)%example.height;}renderValues();},300);
    };
    $$('[data-input-row]').forEach(row=>{
      const channel=+row.dataset.inputRow;
      row.onclick=()=>{stopScan();inputChannel=channel;details=true;renderValues();};
      row.onpointerenter=()=>highlightRow(channel);
      row.onpointerleave=()=>highlightRow(inputChannel);
      bindMap(row.querySelector('.source-map'),'input',channel);
      bindMap(row.querySelector('.contribution-map'),'output',channel);
    });
    bindMap($('#expanded-output canvas'),'output');
    renderValues();
  }
  function changePage(delta){stopScan();page+=delta;inputChannel=page*3;renderExpanded();const target=$(delta>0?'#source-page-next':'#source-page-prev');(target.disabled?$('#expanded-layer'):target).focus({preventScroll:true});}
  function highlightRow(channel) {
    $$('[data-input-row]').forEach(row=>row.classList.toggle('active',+row.dataset.inputRow===channel));
    $$('#expanded-links [data-channel]').forEach(path=>path.classList.toggle('active',+path.dataset.channel===channel));
  }
  function selectPixel(event,canvas,type,channel) {
    const r=canvas.getBoundingClientRect();
    const px=clamp(Math.floor((event.clientX-r.left)/r.width*(type==='input'?example.inputWidth:example.width)),(type==='input'?example.inputWidth:example.width)-1);
    const py=clamp(Math.floor((event.clientY-r.top)/r.height*(type==='input'?example.inputHeight:example.height)),(type==='input'?example.inputHeight:example.height)-1);
    stopScan();x=type==='input'?clamp(Math.round(px/example.layer.stride),example.width-1):px;y=type==='input'?clamp(Math.round(py/example.layer.stride),example.height-1):py;
    if(channel!==undefined)inputChannel=channel;
    renderValues();
  }
  function bindMap(canvas,type,channel) {
    canvas.onpointermove=e=>{if(e.pointerType!=='touch')selectPixel(e,canvas,type,channel);};
    canvas.onclick=e=>selectPixel(e,canvas,type,channel);
    canvas.onkeydown=e=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
      e.preventDefault();stopScan();x=clamp(x+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0),example.width-1);y=clamp(y+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0),example.height-1);renderValues();
    };
  }
  function renderValues() {
    const window={x:x*example.layer.stride-example.padding,y:y*example.layer.stride-example.padding,size:example.layer.kernel};
    $$('[data-input-row]').forEach(row=>{
      const c=+row.dataset.inputRow;
      paint(row.querySelector('.source-map'),example.inputs[c],{window,scale:255,rgbChannel:example.sourceId==='input'?c:undefined});
      paint(row.querySelector('.contribution-map'),example.contributions[c],{cell:{x,y}});
      row.querySelector('.row-value').textContent=`此格贡献 = ${example.contributions[c][y][x]}`;
    });
    let paths='';
    $$('[data-input-row]').forEach(row=>{
      const c=+row.dataset.inputRow,cy=137+(c-page*3)*132;
      paths+=`<path data-channel="${c}" d="M206 ${cy}H245 M300 ${cy}H355 M522 ${cy}C610 ${cy} 620 269 687 269"/>`;
    });
    paths+='<path class="active" d="M707 125V248 M728 269H886"/>';
    $('#expanded-links').innerHTML=paths;
    paint($('#expanded-output canvas'),example.output,{cell:{x,y}});
    $('#pixel-address').textContent=`(${x}, ${y})`;
    $('#expanded-total').textContent=`${example.sum[y][x]} + ${example.bias}`;
    $('#expanded-code').textContent=`此格输出 = ${example.output[y][x]}`;
    highlightRow(inputChannel);
    if(details)renderInspector(window);
  }
  function renderInspector(window) {
    const values=inspectPixel(example,inputChannel,x,y), k=example.layer.kernel;
    $('#pixel-inspector').hidden=false;
    // Keep canvases stable during pointer movement so focus and hover remain intact.
    if(!$('#detail-input')||$('#pixel-inspector').dataset.kernel!==String(k)){
      $('#pixel-inspector').dataset.kernel=k;
      $('#pixel-inspector').innerHTML=`<div class="inspector-heading"><div><b id="detail-title"></b><small>输入窗口和输出像素同步；边界之外按 0 计算。</small></div><button id="close-pixel">收起数值 ×</button></div><div class="inspector-scroll"><div class="inspector-grid"><div class="detail-image"><span>输入通道 · 放大窗口</span><canvas id="detail-input" width="640" height="360" tabindex="0" aria-label="放大的输入特征图"></canvas></div><div class="detail-math"><span>像素 × 权重 = 乘积</span><div id="products" style="--kernel:${k}"></div><p id="partial-sum"></p></div><div class="detail-image"><span>选中输出通道 · 放大像素</span><canvas id="detail-output" width="480" height="270" tabindex="0" aria-label="放大的输出特征图"></canvas><p id="other-contributions"></p></div></div></div><div class="pixel-equation"><span>全部通道之和 <b id="pixel-total"></b></span><span>+ 偏置 <b id="pixel-bias"></b></span><span id="pixel-rounding"></span><span>= 输出 <b id="pixel-code"></b></span></div>`;
      $('#close-pixel').onclick=()=>{details=false;$('#pixel-inspector').hidden=true;};
      bindMap($('#detail-input'),'input',inputChannel);
      bindMap($('#detail-output'),'output');
    }
    // The inspected channel can change without changing the kernel size.
    bindMap($('#detail-input'),'input',inputChannel);
    $('#detail-title').textContent=`L${selectedLayer} · 输入通道 ${inputChannel} → 输出通道 ${outputChannel} · 像素 (${x}, ${y})`;
    paint($('#detail-input'),example.inputs[inputChannel],{window,scale:255,rgbChannel:example.sourceId==='input'?inputChannel:undefined});
    paint($('#detail-output'),example.output,{cell:{x,y}});
    $('#products').innerHTML=values.products.map((row,r)=>row.map((v,c)=>`<div class="product-cell"><span>${values.window[r][c]} <i>×</i> ${example.kernels[inputChannel][r][c]}</span><b>${v}</b></div>`).join('')).join('');
    $('#partial-sum').textContent=`本通道贡献 = ${values.products.flat().join(' + ')} = ${values.contribution}`;
    $('#other-contributions').textContent=`其余 ${example.inputs.length-1} 个通道合计 ${values.otherSum}；不能遗漏。`;
    $('#pixel-total').textContent=values.sum;$('#pixel-bias').textContent=example.bias;$('#pixel-code').textContent=values.output;
    $('#pixel-rounding').textContent=`→ ÷ ${2**example.shift} · 舍入 · ${example.layer.relu?'ReLU / 饱和':'有符号饱和'}`;
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){stopScan();if(details){details=false;$('#pixel-inspector').hidden=true;}else close();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScan();});
  return { refresh(){renderOverview();if(opened){stopScan();renderExpanded();}}, close };
}
