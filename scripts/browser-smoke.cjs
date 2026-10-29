'use strict';
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {topics}=require('../evolution-models.js');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'test-artifacts');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.md':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
  const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
  fs.mkdirSync(artifacts,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const executable=process.env.BROWSER_PATH||(['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync));
  const browser=process.env.BROWSER_CDP_URL?await chromium.connectOverCDP(process.env.BROWSER_CDP_URL):
    await chromium.launch({headless:true,...(executable?{executablePath:executable}:{}),args:['--disable-gpu','--no-sandbox']});
  const errors=[];let states=0;
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url());});
    await page.goto(base);assert.equal(await page.locator('a[href^="evolution.html?topic="]').count(),13);
    await page.screenshot({path:path.join(artifacts,'index-desktop.png'),fullPage:true});
    for(const topic of topics){
      await page.goto(base+'/evolution.html?topic='+topic.id);
      await page.waitForFunction(id=>document.body.dataset.topic===id,topic.id);
      assert.equal(await page.locator('#play').textContent(),'播放');
      for(let step=0;step<topic.steps.length;step++){
        await page.locator('#progress').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},step);
        await page.waitForFunction(value=>Number(document.body.dataset.step)===value,step);
        assert.equal(await page.locator('#step-caption').textContent(),topic.steps[step]);states++;
      }
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,topic.id+' desktop overflow');
      if(['boundary','touch','tracks','frame'].includes(topic.id))await page.screenshot({path:path.join(artifacts,topic.id+'-desktop.png'),fullPage:true});
      await page.locator('#restart').click();assert.equal(await page.locator('#play').textContent(),'暂停');
      await page.locator('#play').click();await page.locator('#next-step').click();assert.equal(await page.locator('body').getAttribute('data-step'),'1');
      await page.locator('#previous-step').click();assert.equal(await page.locator('body').getAttribute('data-step'),'0');
    }
    await page.goto(base+'/evolution.html?topic=tracks');await page.locator('#play').click();
    await page.waitForFunction(()=>Number(document.body.dataset.step)>=1,{},{timeout:6000});await page.locator('#play').click();
    await page.goto(base+'/evolution.html?topic=crop');await page.getByRole('slider',{name:'原始检测框宽度'}).evaluate(el=>{el.value='480';el.dispatchEvent(new Event('input',{bubbles:true}));});assert.match(await page.locator('.experiment-value').textContent(),/30 px/);
    await page.goto(base+'/evolution.html?topic=loader');await page.locator('#bad-crc').check();
    await page.goto(base+'/evolution.html?topic=touch');await page.locator('#show-bounds').check();
    await page.goto(base+'/evolution.html?topic=commands');await page.getByLabel('当前终端').selectOption('powershell');
    await page.setViewportSize({width:390,height:844});
    for(const topic of topics){await page.goto(base+'/evolution.html?topic='+topic.id);await page.waitForFunction(id=>document.body.dataset.topic===id,topic.id);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,topic.id+' mobile overflow');}
    await page.screenshot({path:path.join(artifacts,'latency-mobile.png'),fullPage:true});
    await page.goto(base+'/evolution.html?topic=touch');await page.locator('#progress').evaluate(el=>{el.value='5';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.screenshot({path:path.join(artifacts,'touch-mobile.png'),fullPage:true});
    await page.goto(base);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'index mobile overflow');
    await page.screenshot({path:path.join(artifacts,'index-mobile.png'),fullPage:true});
    await page.goto(pathToFileURL(path.join(root,'evolution.html')).href+'?topic=mailbox');await page.waitForFunction(()=>document.body.dataset.topic==='mailbox');
    await page.locator('#next-step').click();assert.equal(await page.locator('body').getAttribute('data-step'),'1');
    for(const name of ['pipeline.html','line_buffer.html','anim3_yolo_postprocess.html','anim4_crop_resize.html','anim5_crop_fifo.html','anim6_lprnet_ctc.html','anim7_mailbox_cdc.html']){await page.goto(base+'/'+name);await page.waitForSelector('canvas');}
    assert.deepEqual(errors,[],'browser errors');
    const result={result:'PASS',topics:topics.length,states,legacyPages:7,mobileWidth:390,offlineFileMode:true,errors};
    fs.writeFileSync(path.join(artifacts,'browser-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
