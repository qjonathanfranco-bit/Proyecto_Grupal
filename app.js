/* Inventario grupal: conserva datos y acciones originales, con nodos seguros y PWA. */
$(function(){
'use strict';
if(window.__inventarioInicializado)return;window.__inventarioInicializado=true;
const CONFIG=window.INVENTARIO_CONFIG;
const COLORS=['#0f7b6c','#2563eb','#7c3aed','#db2777','#d97706','#475569'];
const KEY='inv_data_v1',MAX=10000;
let products=[],moves=[],editId=null,color=COLORS[0],image='',imageVersion=0,imageBusy=false;
let view='inicio',home='destacados',contact='datos',cur=0,timer,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let previewTimer,previewDeadline=0,pendingMove=null,returnFocus=null,toastTimer,frame;
const paging={},urls=new Set();
const money=n=>CONFIG.moneda+' '+Number(n).toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2});
const status=p=>p.stock<=0?'out':p.stock<=p.min?'low':'ok';
const LBL={ok:'Disponible',low:'Stock bajo',out:'Agotado'};
const find=id=>products.find(p=>p.id===Number(id));
const text=(tag,value,cls)=>$('<'+tag+'>').addClass(cls||'').text(value==null?'':String(value));
const safeNumber=(n,min=0)=>Number.isFinite(Number(n))&&Number(n)>=min&&Number(n)<=1e12;
function safeImage(value){return typeof value==='string'&&value.length<=520000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)?value:'';}
function safeProduct(p){return p&&Number.isSafeInteger(p.id)&&p.id>0&&typeof p.name==='string'&&typeof p.sku==='string'&&typeof p.cat==='string'&&safeNumber(p.price,.01)&&Number.isSafeInteger(p.stock)&&p.stock>=0&&Number.isSafeInteger(p.min)&&p.min>=0;}
function load(){
 try{
  const raw=localStorage.getItem(KEY);
  if(raw){const d=JSON.parse(raw);if(!Array.isArray(d.p)||!Array.isArray(d.m)||!d.p.every(safeProduct))throw new Error('Datos no válidos');
   products=d.p.slice(0,MAX).map(p=>({...p,price:Number(p.price),desc:typeof p.desc==='string'?p.desc:'',emoji:typeof p.emoji==='string'?p.emoji:'📦',color:/^#[0-9a-f]{6}$/i.test(p.color)?p.color:COLORS[0],image:safeImage(p.image),fav:Boolean(p.fav)}));
   moves=d.m.slice(-MAX).filter(m=>m&&typeof m.name==='string'&&['in','out'].includes(m.type)&&Number.isSafeInteger(m.qty)&&m.qty>0).map(m=>({...m,date:String(m.date||''),note:String(m.note||'')}));return;
  }
 }catch(e){try{const original=localStorage.getItem(KEY);if(original)localStorage.setItem(KEY+'_respaldo',original);}catch{}toast('Se guardó un respaldo de los datos que no pudieron leerse.');}
 products=[{id:1,name:'Producto de ejemplo A',sku:'EJ-001',cat:'General',price:25,stock:40,min:10,desc:'Reemplaza con tus productos.',emoji:'🛍️',color:COLORS[0]},{id:2,name:'Producto de ejemplo B',sku:'EJ-002',cat:'General',price:120,stock:6,min:8,desc:'',emoji:'🎁',color:COLORS[2]},{id:3,name:'Insumo de ejemplo',sku:'IN-001',cat:'Insumos',price:8.5,stock:0,min:20,desc:'',emoji:'🧴',color:COLORS[4]},{id:4,name:'Accesorio de ejemplo',sku:'AC-001',cat:'Accesorios',price:49.9,stock:75,min:15,desc:'',emoji:'🎧',color:COLORS[1]}];moves=[];
}
function save(){try{const data={p:products,m:moves};localStorage.setItem(KEY,JSON.stringify(data));window.dispatchEvent(new CustomEvent('inventario-cambio',{detail:{clave:KEY,datos:[data]}}));return true;}catch{return false;}}
function savedToast(message){toast(message+(save()?'':' · No se pudo guardar: estos cambios solo están en esta pestaña.'));}
function toast(message){clearTimeout(toastTimer);$('#toast').stop(true,true).text(message).addClass('show').hide().slideDown(160);toastTimer=setTimeout(()=>$('#toast').fadeOut(200,()=>$('#toast').removeClass('show')),3000);}
function cats(){return [...new Set(products.map(p=>p.cat))].sort((a,b)=>a.localeCompare(b));}
function setTheme(t){$('html').attr('data-theme',t);$('#themeBtn').text(t==='dark'?'☀️':'🌙');try{localStorage.setItem('inv_theme',t);}catch{}}
let theme;try{theme=localStorage.getItem('inv_theme');}catch{}setTheme(theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
$('#themeBtn').off('click.inv').on('click.inv',()=>setTheme($('html').attr('data-theme')==='dark'?'light':'dark'));
function menu(open){$('body').toggleClass('nav-open',open);$('#burger').attr({'aria-expanded':String(open),'aria-label':open?'Cerrar menú':'Abrir menú'});}
$('#burger').off('click.inv').on('click.inv',()=>menu(!$('body').hasClass('nav-open')));$('#scrim').off('click.inv').on('click.inv',()=>menu(false));
function show(v){if(!['inicio','inventario','movimientos','contacto','responsable'].includes(v))v='inicio';view=v;$('.view').removeClass('active').attr('hidden','hidden');$('#v-'+v).addClass('active').removeAttr('hidden');$('nav.side [data-view]').removeClass('active').removeAttr('aria-current').filter('[data-view="'+v+'"]').addClass('active').attr('aria-current','page');menu(false);auto();schedule();}
$('nav.side').off('click.inv','[data-view]').on('click.inv','[data-view]',function(e){e.preventDefault();const v=this.dataset.view;history.replaceState(null,'','#'+v);show(v);});
$(window).off('hashchange.inv').on('hashchange.inv',()=>show(location.hash.slice(1)));
function chooseHome(id){home=id;$('.home-panel').prop('hidden',true).removeClass('active');$('#home-'+id).prop('hidden',false).addClass('active');$('[data-home]').attr({'aria-selected':'false',tabindex:-1}).filter('[data-home="'+id+'"]').attr({'aria-selected':'true',tabindex:0});auto();schedule();}
$('[data-home]').off('click.inv').on('click.inv',function(){chooseHome(this.dataset.home);});
function chooseContact(id){contact=id;$('.contact-panel').prop('hidden',true);$('#contact-'+id).prop('hidden',false);$('[data-contact]').attr({'aria-selected':'false',tabindex:-1}).filter('[data-contact="'+id+'"]').attr({'aria-selected':'true',tabindex:0});if(id==='form')open('#mContact');}
$('[data-contact]').off('click.inv').on('click.inv',function(){chooseContact(this.dataset.contact);});
$('.subtabs').off('keydown.inv','[role=tab]').on('keydown.inv','[role=tab]',function(e){if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const items=$(this).parent().find('[role=tab]');let i=items.index(this);i=e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowLeft'?-1:1)+items.length)%items.length;items.eq(i).trigger('click').trigger('focus');});
function go(i){cur=(i+3)%3;$('#track').css('transform','translateX(-'+cur*100+'%)');$('#dots button').removeClass('on').attr('aria-pressed','false').eq(cur).addClass('on').attr('aria-pressed','true');}
function auto(){clearInterval(timer);timer=null;$('#pauseCarousel').text(paused?'Reanudar':'Pausar');if(paused||document.hidden||view!=='inicio'||home!=='destacados'||$('.modal.show').length||$('#carousel').is(':hover')||document.getElementById('carousel').contains(document.activeElement))return;timer=setInterval(()=>go(cur+1),5000);}
for(let i=0;i<3;i++)$('#dots').append($('<button>').attr({type:'button','data-i':i,'aria-label':'Ir a la diapositiva '+(i+1),'aria-pressed':String(i===0)}));
$('.prev').off('click.inv').on('click.inv',()=>{go(cur-1);auto();});$('.next').off('click.inv').on('click.inv',()=>{go(cur+1);auto();});$('#dots').off('click.inv','button').on('click.inv','button',function(){go(Number(this.dataset.i));auto();});$('#pauseCarousel').off('click.inv').on('click.inv',()=>{paused=!paused;auto();});
$('#carousel').off('mouseenter.inv mouseleave.inv focusin.inv focusout.inv').on('mouseenter.inv focusin.inv',()=>clearInterval(timer)).on('mouseleave.inv focusout.inv',auto);$(document).off('visibilitychange.inv').on('visibilitychange.inv',auto);
function card(p){
 const s=status(p),article=$('<article>').addClass('card').attr('data-product-id',p.id),thumb=$('<div>').addClass('thumb').css('background','linear-gradient(135deg,'+p.color+','+p.color+'99)');
 const photo=$('<button>').attr({type:'button','data-photo':p.id,'aria-label':'Ampliar imagen de '+p.name}).addClass('photo-open');
 if(p.image)photo.append($('<img>').attr({src:p.image,alt:p.name,loading:'lazy',decoding:'async',width:640,height:480}));else photo.append(text('span',p.emoji,'emoji-producto'));
 thumb.append(photo,text('span',LBL[s],'badge '+s),$('<button>').attr({type:'button','data-id':p.id,'aria-label':'Favorito: '+p.name,'aria-pressed':String(Boolean(p.fav))}).addClass('fav').toggleClass('on',Boolean(p.fav)).text(p.fav?'★':'☆'));
 const body=$('<div>').addClass('body');
 body.append($('<button>').attr({type:'button','data-detail':p.id,title:p.name}).addClass('product-title').append(text('h3',p.name)),text('div',p.sku+' · '+p.cat,'meta product-meta'),text('div',money(p.price),'price'));
 const bar=$('<div>').addClass('bar '+s).attr({'aria-label':'Existencias respecto al mínimo'}).append($('<i>').css('width',Math.min(100,Math.round(p.stock/Math.max(p.min*3,1)*100))+'%'));
 body.append(bar,text('div',p.stock+' unidades (mínimo '+p.min+')','meta stock-meta'));
 const actions=$('<div>').addClass('actions');[['move','Movimiento'],['edit','Editar'],['del','🗑']].forEach(([action,label])=>actions.append($('<button>').attr({type:'button','data-act':action,'data-id':p.id,'aria-label':(action==='del'?'Eliminar ':label+' de ')+p.name}).addClass('btn sm '+(action==='del'?'danger':'')).text(label)));
 body.append(actions);article.append(thumb,body);return article;
}
function renderStats(){
 let units=0,val=0,low=0;products.forEach(p=>{units+=p.stock;val+=p.stock*p.price;if(status(p)!=='ok')low++;});
 $('#stats').empty();[['Productos',products.length],['Unidades en stock',units],['Valor total',money(val)],['Requieren atención',low]].forEach(([label,value])=>$('#stats').append($('<div>').addClass('stat').append(text('small',label),text('b',value))));
 const cu=new Map();products.forEach(p=>cu.set(p.cat,(cu.get(p.cat)||0)+p.stock));const max=Math.max(1,...cu.values());$('#catChart').empty();cu.forEach((qty,name)=>$('#catChart').append($('<div>').addClass('brow').append(text('span',name).attr('title',name),$('<div>').addClass('bar').append($('<i>').css({width:Math.round(qty/max*100)+'%',background:'var(--accent)'})),text('b',qty))));
 if(!cu.size)$('#catChart').append(text('p','Sin datos todavía.','meta'));
 $('#lowTitle').text(low?low+' producto(s) necesitan reposición':'Todo el stock está en orden');$('#lowText').text(low?'Revisa el inventario y filtra por estado para ver cuáles son.':'No hay productos agotados ni por debajo del mínimo.');$('#valText').text('Tienes '+units+' unidades valoradas en '+money(val)+'.');
 const alert=$('#alertBar').empty();if(low&&!renderStats.off){alert.append(text('span','⚠ '+low+' producto(s) con stock bajo o agotado.'),$('<button>').attr({type:'button',id:'alertGo'}).addClass('btn sm').text('Ver ahora'),$('<button>').attr({type:'button',id:'alertX','aria-label':'Cerrar aviso'}).addClass('btn sm').text('✕')).show();}else alert.hide();
 $('#recent').empty();products.slice(-4).reverse().forEach(p=>$('#recent').append(card(p)));if(!products.length)$('#recent').append(text('p','Aún no hay productos.','empty'));
 $('#responsibleStats').empty();[['Agotados',products.filter(p=>status(p)==='out').length],['Stock bajo',products.filter(p=>status(p)==='low').length]].forEach(([label,qty])=>$('#responsibleStats').append($('<div>').addClass('stat').append(text('small',label),text('b',qty))));
}
function renderFilters(){const selected=$('#fcat').val()||'';$('#fcat').empty().append($('<option>').val('').text('Todas'));$('#cats').empty();cats().forEach(c=>{$('#fcat').append($('<option>').val(c).text(c));$('#cats').append($('<option>').val(c));});$('#fcat').val(cats().includes(selected)?selected:'');}
function renderChips(){const selected=$('#fcat').val()||'';$('#chips,#catList').empty();[['','Todas'],...cats().map(c=>[c,c])].forEach(([value,label])=>{const b=$('<button>').attr({type:'button','data-cat':value,'aria-pressed':String(value===selected)}).addClass('chip').toggleClass('on',value===selected).text(label);$('#chips').append(b);if(value)$('#catList').append($('<button>').attr({type:'button','data-cat':value}).addClass('catlink').text(label));});}
function renderGrid(){
 const max=Math.max(1,...products.map(p=>p.price)),range=Number($('#fprice').val()),lim=max*range/100,q=String($('#fq').val()||'').toLocaleLowerCase().trim(),category=$('#fcat').val()||'',s=$('#fst').val(),sort=$('#fsort').val();$('#pv').text(range>=100?'todos':money(lim));renderChips();
 const result=products.filter(p=>(!q||p.name.toLocaleLowerCase().includes(q)||p.sku.toLocaleLowerCase().includes(q))&&(!category||p.cat===category)&&(!s||(s==='fav'?p.fav:status(p)===s))&&p.price<=lim+.001);
 result.sort((a,b)=>sort==='price-asc'?a.price-b.price:sort==='price-desc'?b.price-a.price:sort==='stock-asc'?a.stock-b.stock:a.name.localeCompare(b.name));$('#grid').empty();result.forEach(p=>$('#grid').append(card(p)));if(!result.length)$('#grid').append(text('p','No hay productos con esos filtros. Prueba limpiarlos o agrega uno nuevo.','empty'));$('#clearF').toggle(Boolean(q||category||s||range<100));paging.grid=0;schedule();
}
function renderMoves(){const labels=['Fecha','Producto','Tipo','Cantidad','Nota'];$('#moves').empty();moves.slice().reverse().forEach(m=>{const tr=$('<tr>');[m.date,m.name,m.type==='in'?'Entrada':'Salida',m.qty,m.note||'-'].forEach((value,i)=>tr.append(text('td',value,i===2?m.type:'').attr({'data-label':labels[i],title:String(value)})));$('#moves').append(tr);});if(!moves.length)$('#moves').append($('<tr>').addClass('empty-moves').append(text('td','Todavía no registraste movimientos.').attr('colspan',5)));schedule();}
function renderAll(){renderStats();renderFilters();renderGrid();renderMoves();}
$('#fq').off('input.inv').on('input.inv',renderGrid);$('#fcat,#fst,#fsort,#fprice').off('input.inv change.inv').on('input.inv change.inv',renderGrid);$('#clearF').off('click.inv').on('click.inv',()=>{$('#fq').val('');$('#fcat,#fst').val('');$('#fprice').val(100);$('#fsort').val('name');renderGrid();});
function fail($el,message){$el.toggleClass('invalid',Boolean(message)).toggleClass('valid',!message&&Boolean(String($el.val()||'').trim())).attr('aria-invalid',String(Boolean(message)));$el.siblings('.err').text(message);return !message;}
function check($el){const value=String($el.val()||'').trim(),id=$el.attr('id');let error='';
 if($el.prop('required')&&!value)error='Este campo es obligatorio.';
 else if($el.attr('maxlength')&&value.length>Number($el.attr('maxlength')))error='Supera la longitud permitida.';
 else if(id==='pname'&&value.length<3)error='Escribe al menos 3 caracteres.';
 else if(id==='psku'){if(!/^[A-Za-z0-9_-]{3,20}$/.test(value))error='Usa 3 a 20 letras, números o guiones.';else if(products.some(p=>p.sku.toLowerCase()===value.toLowerCase()&&p.id!==editId))error='Ese SKU ya existe.';}
 else if(id==='pprice'&&!safeNumber(value,.01))error='El precio debe ser mayor que 0 y finito.';
 else if(id==='cname'&&value.length<3)error='Escribe tu nombre completo.';
 else if(id==='cmail'&&(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)||value.length>150))error='Ingresa un correo válido (ej: nombre@correo.com).';
 else if(id==='cphone'&&(!/^\+?[\d\s()-]+$/.test(value)||value.replace(/\D/g,'').length<7||value.replace(/\D/g,'').length>15))error='Ingresa un teléfono de 7 a 15 dígitos.';
 else if(id==='cmsg'&&value.length<10)error='Cuéntanos un poco más (mínimo 10 caracteres).';
 else if(['pstock','pmin','mqty'].includes(id)&&(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<(id==='mqty'?1:0)))error=id==='mqty'?'Ingresa una cantidad entera mayor que 0.':'Ingresa un número entero de 0 o más.';
 else if(id==='mprod'&&!find(Number(value)))error='Selecciona un producto válido.';
 if(!error&&id==='mqty'&&$('#mtype').val()==='out'){const p=find(Number($('#mprod').val()));if(p&&Number(value)>p.stock)error='Solo hay '+p.stock+' unidades disponibles.';}
 return fail($el,error);
}
function validate(form){let first;form.find('input[required],select[required],textarea[required]').each(function(){if(!check($(this))&&!first)first=this;});if(first)first.focus();return !first;}
$('form').off('blur.inv input.inv change.inv','input[required],select[required],textarea[required]').on('blur.inv input.inv change.inv','input[required],select[required],textarea[required]',function(){check($(this));});
function open(selector){const modal=$(selector);if(!modal.length)return;returnFocus=document.activeElement;$('.modal.show').removeClass('show').prop('hidden',true);modal.prop('hidden',false).addClass('show');menu(false);auto();const target=modal.find('input:not([type=file]),select,textarea,button').filter(':enabled').first()[0];if(target)target.focus();}
function close(){clearInterval(previewTimer);pendingMove=null;$('.modal.show').removeClass('show').prop('hidden',true);$('#toggleF').attr('aria-expanded','false');if(returnFocus&&document.contains(returnFocus))returnFocus.focus();auto();}
$('.modal').off('click.inv').on('click.inv',function(e){if(e.target===this)close();});$(document).off('click.inv','[data-close]').on('click.inv','[data-close]',close);
$(document).off('keydown.inv').on('keydown.inv',function(e){if(e.key==='Escape'){close();menu(false);}if(e.key==='Tab'){
 const trap=$('.modal.show').last()[0]||(document.body.classList.contains('nav-open')?document.getElementById('side'):null);if(!trap)return;const items=[...trap.querySelectorAll('a[href],button,input,select,textarea')].filter(el=>!el.disabled&&!el.hidden&&el.type!=='hidden');if(!items.length)return;const a=items[0],b=items[items.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}
 }});
$('#swatches').empty();COLORS.forEach(c=>$('#swatches').append($('<button>').attr({type:'button','data-c':c,'aria-label':'Color '+c}).css('background',c)));
function pickColor(c){color=c;$('#swatches button').removeClass('on').filter((_,e)=>e.dataset.c===c).addClass('on');}
$('#swatches').off('click.inv','button').on('click.inv','button',function(){pickColor(this.dataset.c);});
function previewImage(){const src=safeImage(image);$('#pimagePreview').attr('src',src||'').prop('hidden',!src);}
$('#removeImage').off('click.inv').on('click.inv',()=>{imageVersion++;image='';imageBusy=false;$('#pimage').val('');$('#pimageError').text('');previewImage();});
$('#pimage').off('change.inv').on('change.inv',async function(){const file=this.files&&this.files[0],version=++imageVersion;imageBusy=Boolean(file);$('#pimageError').text('');if(!file){imageBusy=false;return;}
 try{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>350*1024)throw new Error('Usa PNG, JPG o WEBP de hasta 350 KB.');
  const bytes=new Uint8Array(await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsArrayBuffer(file.slice(0,12));}));
  const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x),jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!(file.type==='image/png'&&png||file.type==='image/jpeg'&&jpg||file.type==='image/webp'&&webp))throw new Error('La imagen no corresponde al formato indicado.');
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});if(version!==imageVersion)return;$('#pimage').removeAttr('aria-invalid');image=safeImage(data);if(!image)throw new Error('No se pudo leer la imagen.');previewImage();
 }catch(e){if(version===imageVersion){$('#pimageError').text(e.message);$('#pimage').attr('aria-invalid','true');}}finally{if(version===imageVersion)imageBusy=false;}
});
function openProd(p){editId=p?p.id:null;imageVersion++;image=p?safeImage(p.image):'';imageBusy=false;$('#pimage').val('').removeAttr('aria-invalid');$('#pimageError').text('');$('#fProd .err').text('');$('#fProd input,#fProd textarea').removeClass('invalid valid').removeAttr('aria-invalid');$('#mProdTitle').text(p?'Editar producto':'Nuevo producto');$('#pname').val(p?p.name:'');$('#psku').val(p?p.sku:'');$('#pcat').val(p?p.cat:'');$('#pprice').val(p?p.price:'');$('#pstock').val(p?p.stock:'');$('#pmin').val(p?p.min:5);$('#pdesc').val(p?p.desc:'');$('#pemoji').val(p?p.emoji:'📦');pickColor(p?p.color:COLORS[0]);previewImage();open('#mProd');}
$('#addBtn').off('click.inv').on('click.inv',()=>openProd(null));
$('#fProd').off('submit.inv').on('submit.inv',function(e){e.preventDefault();if(!validate($(this))){toast('Revisa los campos marcados');return;}if(imageBusy){toast('Espera a que termine de cargar la imagen');return;}if($('#pimage').attr('aria-invalid')==='true'){toast('Quita o reemplaza la imagen no válida');return;}
 const d={name:$('#pname').val().trim(),sku:$('#psku').val().trim().toUpperCase(),cat:$('#pcat').val().trim(),price:Number($('#pprice').val()),stock:Number($('#pstock').val()),min:Number($('#pmin').val()),desc:$('#pdesc').val().trim(),emoji:$('#pemoji').val().trim()||'📦',color,image};
 if(editId){const p=find(editId);if(!p){toast('El producto ya no existe. Vuelve a abrir el formulario.');return;}Object.assign(p,d);}else{d.id=Math.max(Date.now(),...products.map(p=>p.id+1));products.push(d);}close();renderAll();savedToast(editId?'Producto actualizado':'Producto agregado');
});
function openMove(id){if(!products.length){toast('Primero agrega un producto');return;}$('#fMove .err').text('');$('#fMove input').removeClass('invalid valid').removeAttr('aria-invalid');$('#mprod').empty();products.forEach(p=>$('#mprod').append($('<option>').val(p.id).text(p.name+' ('+p.stock+')')));if(id)$('#mprod').val(id);$('#mqty,#mnote').val('');open('#mMove');updateMoveSummary();}
$('#moveBtn').off('click.inv').on('click.inv',()=>openMove());
function movement(){return {id:Number($('#mprod').val()),qty:Number($('#mqty').val()),type:$('#mtype').val(),note:$('#mnote').val().trim()};}
function updateMoveSummary(){const d=movement(),p=find(d.id);$('#moveSummary').text(p&&Number.isSafeInteger(d.qty)&&d.qty>0?(d.type==='out'?'Salida':'Entrada')+': '+d.qty+' × '+money(p.price)+' = '+money(d.qty*p.price):'Selecciona un producto e indica una cantidad.');}
function commitMovement(d){const p=find(d.id);if(!p||!Number.isSafeInteger(d.qty)||d.qty<1||!['in','out'].includes(d.type)){toast('Revisa el producto, el tipo y la cantidad.');return false;}if(d.type==='out'&&d.qty>p.stock){toast('Solo hay '+p.stock+' unidades disponibles.');return false;}const stock=p.stock+(d.type==='in'?d.qty:-d.qty);if(!Number.isSafeInteger(stock)||stock<0){toast('La cantidad supera el límite permitido.');return false;}p.stock=stock;moves.push({name:p.name,type:d.type,qty:d.qty,note:d.note,date:new Date().toLocaleString('es-BO',{dateStyle:'short',timeStyle:'short'})});close();renderAll();savedToast(d.type==='in'?'Entrada registrada':'Salida registrada');return true;}
$('#fMove').off('submit.inv').on('submit.inv',function(e){e.preventDefault();if(validate($(this)))commitMovement(movement());});
$('#mtype,#mprod,#mqty').off('input.inv change.inv').on('input.inv change.inv',()=>{if($('#mqty').val())check($('#mqty'));updateMoveSummary();});
$('#previewMove').off('click.inv').on('click.inv',()=>{if(!validate($('#fMove')))return;pendingMove=movement();const p=find(pendingMove.id);const snapshot=pendingMove;open('#mPreview');pendingMove=snapshot;$('#previewContent').empty().append(text('p',p.name),text('p',(snapshot.type==='in'?'Entrada':'Salida')+' · '+snapshot.qty+' unidades'),text('p','Valor del movimiento: '+money(snapshot.qty*p.price)),text('p',snapshot.note||'Sin nota'));previewDeadline=Date.now()+30000;$('#previewTimer').text('00:30');clearInterval(previewTimer);previewTimer=setInterval(()=>{const left=Math.max(0,Math.ceil((previewDeadline-Date.now())/1000));$('#previewTimer').text('00:'+String(left).padStart(2,'0'));if(!left){close();toast('La confirmación venció. Revisa el movimiento de nuevo.');}},250);});
$('#confirmPreview').off('click.inv').on('click.inv',()=>{if(!pendingMove)return;if(Date.now()>=previewDeadline){close();toast('La confirmación venció.');return;}const d=pendingMove;pendingMove=null;if(!commitMovement(d))close();});
$(document).off('click.inv','[data-act]').on('click.inv','[data-act]',function(){const p=find(this.dataset.id);if(!p)return;const a=this.dataset.act;if(a==='edit')openProd(p);else if(a==='move')openMove(p.id);else if(a==='del'&&confirm('¿Eliminar "'+p.name+'"? Esta acción no se puede deshacer.')){products=products.filter(x=>x.id!==p.id);renderAll();savedToast('Producto eliminado');}});
$(document).off('click.inv','.fav').on('click.inv','.fav',function(){const p=find(this.dataset.id);if(!p)return;p.fav=!p.fav;renderAll();savedToast(p.fav?'Agregado a favoritos':'Quitado de favoritos');});
$(document).off('click.inv','#alertX').on('click.inv','#alertX',()=>{renderStats.off=true;$('#alertBar').slideUp(180,schedule);});$(document).off('click.inv','#alertGo').on('click.inv','#alertGo',()=>{$('#fst').val('low');renderGrid();show('inventario');history.replaceState(null,'','#inventario');});
$(document).off('click.inv','.faq .q').on('click.inv','.faq .q',function(){const answer=$(this).next('.a'),willOpen=!answer.is(':visible');$('.faq .a').not(answer).stop(true,true).slideUp(160);$('.faq .q').not(this).attr('aria-expanded','false');$(this).attr('aria-expanded',String(willOpen));answer.stop(true,true).slideToggle(160);});
$('#clearMoves').off('click.inv').on('click.inv',()=>{if(moves.length&&confirm('¿Vaciar todo el historial de movimientos?')){moves=[];renderAll();savedToast('Historial vaciado');}});
$('#exportBtn').off('click.inv').on('click.inv',()=>{const rows=[['SKU','Nombre','Categoria','Precio','Stock','Minimo'],...products.map(p=>[p.sku,p.name,p.cat,p.price,p.stock,p.min])];const csv='\ufeff'+rows.map(row=>row.map(value=>{let s=String(value);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\n');try{const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));urls.add(url);const a=document.createElement('a');a.href=url;a.download='inventario.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},1000);toast('CSV exportado');}catch{toast('No se pudo exportar aquí');}});
$('#catToggle').off('click.inv').on('click.inv',function(){const expanded=$(this).attr('aria-expanded')==='true';$(this).attr('aria-expanded',String(!expanded));$('#catList').stop(true,true).slideToggle(160);});
$('#toggleF').off('click.inv').on('click.inv',function(){$(this).attr('aria-expanded','true');open('#mFilters');});$('#toggleStats').off('click.inv').on('click.inv',function(){$('#stats').stop(true,true).slideToggle(180,()=>{$(this).text($('#stats').is(':visible')?'Ocultar resumen':'Mostrar resumen');});});
$('#toggleCo').off('click.inv').on('click.inv',()=>$('#coBox').stop(true,true).slideToggle(160));$('#toggleSoc').off('click.inv').on('click.inv',()=>$('#socBox').stop(true,true).fadeToggle(160));
$(document).off('click.inv','.chip,.catlink').on('click.inv','.chip,.catlink',function(){$('#fcat').val(this.dataset.cat||'');renderGrid();if($(this).hasClass('catlink')){show('inventario');history.replaceState(null,'','#inventario');}});
function detail(id){const p=find(id);if(!p)return;$('#detailsTitle').text(p.name);const box=$('#detailsContent').empty();box.append(text('p',p.sku+' · '+p.cat,'meta'),text('p',p.desc||'Sin descripción'),text('p','Precio: '+money(p.price)),text('p','Existencias: '+p.stock+' · Mínimo: '+p.min),text('p','Valor en stock: '+money(p.stock*p.price)),$('<button>').attr({type:'button','data-photo':p.id}).addClass('btn').text('Ver imagen ampliada'));const wa=(CONFIG.redes||[]).find(x=>/whatsapp/i.test(x.n));if(wa&&/^https:\/\//i.test(wa.u)){const message='Hola, quisiera consultar sobre '+p.name+' (SKU '+p.sku+').';box.append(text('p',message,'meta'),$('<a>').attr({href:wa.u,target:'_blank',rel:'noopener noreferrer'}).addClass('btn primary').text('Consultar por WhatsApp'),$('<button>').attr('type','button').addClass('btn').text('Copiar consulta').on('click.inv',()=>{navigator.clipboard?.writeText(message).then(()=>toast('Consulta copiada')).catch(()=>toast('Copia el texto mostrado arriba'));}));}open('#mDetails');}
$(document).off('click.inv','[data-detail],.more').on('click.inv','[data-detail],.more',function(){detail(this.dataset.detail||$(this).closest('[data-product-id]').attr('data-product-id'));});
$(document).off('click.inv','[data-photo]').on('click.inv','[data-photo]',function(){const p=find(this.dataset.photo);if(!p)return;$('#photoTitle').text(p.name);const content=$('#photoContent').empty();if(p.image)content.append($('<img>').attr({src:p.image,alt:p.name,decoding:'async'}));else content.append(text('div',p.emoji,'emoji-ampliado'));open('#mPhoto');});
function safeLink(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
$('.socials').empty();(CONFIG.redes||[]).forEach(r=>{const url=safeLink(r.u);if(url)$('.socials').each(function(){$(this).append($('<a>').addClass('social').attr({href:url,target:'_blank',rel:'noopener noreferrer','aria-label':r.n,title:r.n}).append(text('span',r.i),text('span',r.n,'social-label')));});});
const E=CONFIG.empresa;$('#coBox').empty();[['Razón social',E.razon],['NIT',E.nit],['Dirección',E.dir],['Teléfono',E.tel],['Correo',E.mail],['Horario',E.horario]].forEach(([label,value])=>$('#coBox').append($('<li>').append(text('b',label+': '),text('span',value))));$('#fInfo').text(E.razon+' · NIT '+E.nit+' · '+new Date().getFullYear());
$('#cmsg').off('input.inv').on('input.inv',function(){$('#cnt').text(this.value.length+'/300');});$('#fCont').off('submit.inv').on('submit.inv',function(e){e.preventDefault();if(!validate($(this))){toast('Revisa los campos marcados');return;}const item={id:Date.now(),name:$('#cname').val().trim(),email:$('#cmail').val().trim(),phone:$('#cphone').val().trim(),message:$('#cmsg').val().trim(),date:new Date().toISOString()};try{let list;try{list=JSON.parse(localStorage.getItem('inv_contactos_v1')||'[]');}catch{list=[];}list=(Array.isArray(list)?list:[]).concat(item).slice(-100);localStorage.setItem('inv_contactos_v1',JSON.stringify(list));window.dispatchEvent(new CustomEvent('inventario-cambio',{detail:{clave:'inv_contactos_v1',datos:list}}));this.reset();$(this).find('.valid').removeClass('valid');$('#cnt').text('0/300');$('#okMsg').show();toast('Consulta guardada en este dispositivo; no enviada.');}catch{toast('No se pudo guardar. Copia tu mensaje antes de salir.');}});
$('#openContact').off('click.inv').on('click.inv',()=>open('#mContact'));$('#responsibleGo').off('click.inv').on('click.inv',()=>{show('inventario');history.replaceState(null,'','#inventario');});
function paginate(key,elements,pager,capacity){const list=[...elements],count=Math.max(1,Math.ceil(list.length/capacity));paging[key]=Math.min(Math.max(0,paging[key]||0),count-1);list.forEach((el,i)=>{el.hidden=i<paging[key]*capacity||i>=(paging[key]+1)*capacity;});const controls=$(pager).empty();if(count<=1){controls.prop('hidden',true);return;}controls.prop('hidden',false);controls.append($('<button>').attr({type:'button','aria-label':'Página anterior'}).addClass('btn').prop('disabled',paging[key]===0).text('←').on('click.inv',()=>{paging[key]--;schedule();}),text('span','Página '+(paging[key]+1)+' de '+count),$('<button>').attr({type:'button','aria-label':'Página siguiente'}).addClass('btn').prop('disabled',paging[key]===count-1).text('→').on('click.inv',()=>{paging[key]++;schedule();}));}
function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(layout);}
function layout(){
 for(const [key,id,pager]of [['grid','grid','gridPager'],['recent','recent','recentPager']]){
  const grid=document.getElementById(id);if(!grid.closest('.view.active')||(id==='recent'&&home!=='recientes'))continue;
  const width=grid.clientWidth||innerWidth-40,height=grid.clientHeight||Math.max(230,innerHeight-300),cols=width>=900?3:width>=500?2:1,rows=Math.max(1,Math.min(3,Math.floor((height+10)/250))),items=grid.querySelectorAll('.card');
  grid.style.setProperty('--cols',cols);grid.style.setProperty('--rows',Math.min(rows,Math.max(1,Math.ceil(items.length/cols))));paginate(key,items,'#'+pager,cols*rows);
 }
 if(view==='movimientos'){const table=document.querySelector('.tbl'),height=table.clientHeight||innerHeight-230,capacity=Math.max(1,Math.floor(height/(innerWidth<600?116:52)));paginate('moves',document.querySelectorAll('#moves tr:not(.empty-moves)'),'#movesPager',capacity);}
 if(view==='inicio'&&home==='categorias'){const chart=document.getElementById('catChart'),height=chart.clientHeight||innerHeight-330;paginate('chart',chart.querySelectorAll('.brow'),'#chartPager',Math.max(1,Math.floor(height/40)));}
}
function viewport(){const vv=window.visualViewport;document.documentElement.style.setProperty('--app-height',Math.round(vv?vv.height:innerHeight)+'px');schedule();}
$(window).off('resize.inv orientationchange.inv').on('resize.inv orientationchange.inv',viewport);if(window.visualViewport)visualViewport.addEventListener('resize',viewport);
$(window).off('pagehide.inv pageshow.inv').on('pagehide.inv',()=>{clearInterval(timer);clearInterval(previewTimer);clearTimeout(toastTimer);cancelAnimationFrame(frame);pendingMove=null;$('.modal.show').removeClass('show').prop('hidden',true);urls.forEach(url=>URL.revokeObjectURL(url));urls.clear();}).on('pageshow.inv',()=>{viewport();auto();});
// Keep original storage keys and company configuration; never reset data on updates.
document.title='Inventario · '+CONFIG.nombre;$('#brandName').text(CONFIG.nombre);$('#logo').text(CONFIG.logo);
$('#filtersContent').append($('#toolbar'),$('#chips'));$('#toolbar').show();$('.faq .q').attr('aria-expanded','false');
document.documentElement.dataset.hidratado='true';load();renderAll();go(0);show(location.hash.slice(1)||'inicio');chooseHome('destacados');viewport();
});
