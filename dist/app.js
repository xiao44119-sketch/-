'use strict';
const toast=document.querySelector('#toast');
let toastTimer;
async function copyText(text){
  let success=false;
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);success=true;}}catch{}
  if(!success){const field=document.createElement('textarea');field.value=text;field.setAttribute('readonly','');field.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.append(field);field.select();try{success=document.execCommand('copy');}catch{}field.remove();}
  toast.textContent=success?'已复制，可以粘贴发送了。':'复制未完成，请长按选中页面中的文字复制。';toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),3500);
}
document.querySelector('[data-wechat]').addEventListener('click',()=>copyText('18300425760'));
document.querySelector('[data-copy-intro]').addEventListener('click',()=>copyText(document.querySelector('.intro-copy p').textContent));
