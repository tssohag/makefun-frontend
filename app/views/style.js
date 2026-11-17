// The full stylesheet, adopted before the header's controls or any view are put on the page (index.html's shell inlines
// only the critical rules: base colours, the header's box, the skeleton), so the first load stays one small file and
// nothing paints unstyled.
const stylesheet = new CSSStyleSheet();
stylesheet.replaceSync(String.raw`
:root{--mut:#5d5a68;--ok:#17703f;--r:12px;--ac2:#fce4ef;--sk:#ebe8ef;--on-ac:#fff;--hd:#fffffff2;--ink2:#3b3844;--th:#faf9fb;--line2:#f0edf3;--hov:#fdf5f9;--okbg:#e3f4ea;--warn:#a14807;--warnbg:#fdf0e1;--soonbg:#fff8e6;--chip:#eceaf0;--red:#c62828}
:root[data-theme=dark]{--mut:#a9a5b5;--ok:#5fd394;--ac2:#3b1f2d;--sk:#24222b;--on-ac:#1d0a13;--hd:#1c1b22f2;--ink2:#cfccd8;--th:#23212a;--line2:#2a2831;--hov:#2a2330;--okbg:#17321f;--warn:#f5b04a;--warnbg:#382a14;--soonbg:#2d2615;--chip:#2c2a33;--red:#ff8a80}
*{box-sizing:border-box}
header{box-sizing:content-box}
a{color:var(--ac);text-decoration:none}
a:hover{text-decoration:underline}
body{padding-bottom:30px}
[data-k=board] main{max-width:1480px}
header::after{display:none}
nav{display:flex;gap:4px}
nav>*{font:inherit;color:var(--ink);font-weight:600;padding:6px 12px;border-radius:99px;border:0;background:none}
#tick{flex:1 1 0;min-width:0;margin:0;font-size:13px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#tick b{color:var(--ink)}#tick i{font-style:normal;color:var(--mut)}
form{flex:0 1 360px;margin-left:auto}
input{width:100%;font:inherit;color:var(--ink);padding:8px 14px;border:1px solid var(--line);border-radius:99px;background:var(--bg)}
#live{width:92px;text-align:right;font-size:13px;font-weight:600;color:var(--ok)}
#theme{width:36px;height:36px}
[data-theme=dark]{color-scheme:dark}
header{position:sticky;top:0}
#live{white-space:nowrap}
.meter{position:fixed;z-index:7;inset:auto 0 0;display:flex;gap:16px;justify-content:space-between;padding:5px max(20px,50% - 720px);font-size:12px;color:var(--mut);background:var(--card);border-top:1px solid var(--line);white-space:nowrap}
.meter span{overflow:hidden;text-overflow:ellipsis}.meter b{color:var(--ink);font-variant-numeric:tabular-nums}.meter i{font-style:normal;overflow:hidden;text-overflow:ellipsis;flex-shrink:9}
h1{font-size:30px;line-height:1.15;margin:6px 0;letter-spacing:-.02em}
h2{font-size:17px;margin:0 0 12px}
h2 small,.muted{color:var(--mut);font-weight:400}
:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
header{z-index:5;background:var(--hd);backdrop-filter:blur(8px)}
nav [aria-current],nav a:hover{background:var(--ac2);text-decoration:none}
form input:focus{outline:2px solid var(--ac);background:var(--card)}
#theme{display:grid;place-items:center;flex:none;padding:0;opacity:1;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
#theme::before{content:"";width:16px;height:16px;border-radius:50%;box-shadow:inset -5px -3px 0 0 currentColor}
[data-theme=dark] #theme::before{box-shadow:inset 0 0 0 9px currentColor}
#live::before{content:"";display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:50%;background:var(--ok);animation:pulse 2s infinite}
@keyframes pulse{50%{opacity:.3}}
.sk{background:var(--sk);animation:pulse 1.2s infinite}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chips button{font:inherit;font-size:13px;font-weight:600;padding:3px 11px;border-radius:99px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
.chips [aria-pressed=true]{background:var(--ac);border-color:var(--ac);color:var(--on-ac)}
.sort{font-size:13px;color:var(--mut)}
select{font:inherit;font-size:13px;padding:3px 8px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink)}
.cd.soon{color:var(--red)}
.btn{display:inline-block;font:inherit;font-size:14px;font-weight:700;padding:7px 16px;border-radius:99px;background:var(--ac);color:var(--on-ac);border:1px solid var(--ac);cursor:pointer}
.btn:hover{text-decoration:none;filter:brightness(1.08)}
.btn.ghost{background:var(--card);color:var(--ac)}
.num{text-align:right;font-variant-numeric:tabular-nums}
.empty{text-align:center;padding:48px 20px;background:var(--card);border:1px dashed var(--line);border-radius:var(--r)}
.board{min-width:0}
.md{display:grid;grid-template-columns:minmax(0,640px) minmax(0,1fr);gap:18px;align-items:start}
.detail .sk{height:560px}
.bhead{display:flex;flex-wrap:wrap;align-items:center;gap:2px 14px;margin-bottom:8px}
.bhead h1{font-size:24px;margin:0}
.seg{display:inline-flex;gap:2px;margin-left:auto;padding:3px;border-radius:99px;background:var(--chip)}
.seg button{font:inherit;font-size:13px;font-weight:700;padding:3px 13px;border:0;border-radius:99px;background:none;color:var(--mut);cursor:pointer}
.seg b{margin-left:3px;font-variant-numeric:tabular-nums}
.seg [aria-pressed=true]{background:var(--card);color:var(--ink);box-shadow:0 1px 3px #0003}.seg [aria-pressed=true] b{color:var(--ac)}
.kpi{flex-basis:100%;margin:0;color:var(--mut);font-size:14px}
.kpi b{color:var(--ink);font-variant-numeric:tabular-nums}
.tools{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}
.btable{background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
.brow{display:grid;grid-template-columns:minmax(0,1fr) 72px 118px 52px 92px;gap:10px;align-items:center;padding:3px 12px;border-top:1px solid var(--line2);color:var(--ink);font-size:14px;border-left:3px solid transparent}
.brow:hover{background:var(--hov);text-decoration:none}
.brow.sel{background:var(--ac2);border-left-color:var(--ac)}
.brow.bh{border-top:0;padding-top:6px;padding-bottom:6px;background:var(--th);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--mut)}
.bt,.pot,.od{min-width:0;display:flex;flex-direction:column;line-height:1.25}
.bt b,.bt small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt b{font-weight:650}
.bt small,.pot small,.od small{color:var(--mut);font-size:12px;white-space:nowrap}
.brow .pot{font-weight:800;color:var(--ac);font-size:15px}
.brow .pot small{font-weight:600}
.fee,.pot small.fee{color:var(--warn)}.free,.fs,.pot small.free{color:var(--ok)}
.od b{font-weight:700}
.cat{font-style:normal;font-weight:700;margin-right:6px;color:var(--ac)}
.tl{font-variant-numeric:tabular-nums;font-size:13px;font-weight:600;white-space:nowrap;line-height:1.2}
.tl small{display:block;color:var(--mut);font-weight:500;font-size:11px}
.tbar{display:block;height:4px;margin-top:4px;border-radius:9px;background:var(--chip);overflow:hidden}
.tbar i{display:block;height:100%;background:linear-gradient(90deg,#e48ab0,var(--ac));border-radius:9px}
.group.done{background:var(--th);color:var(--mut)}
.group{padding:6px 12px;border-top:1px solid var(--line);background:var(--soonbg);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--warn)}
.none{padding:24px;text-align:center;color:var(--mut)}
.hint{margin:6px 2px 0;font-size:12px;color:var(--mut)}
.activity{display:flex;flex-direction:column;margin-top:10px;padding:10px 14px 4px;background:var(--card);border:1px solid var(--line);border-radius:var(--r)}
.activity h2{font-size:15px;margin:0 0 4px}
.activity .sk{height:150px}
.activity ul{list-style:none;margin:0;padding:0}
.activity li{display:grid;grid-template-columns:22px auto minmax(0,1fr) auto;gap:8px;align-items:center;height:31px;border-top:1px solid var(--line2);font-size:13.5px;white-space:nowrap}
.activity li>:nth-child(3){overflow:hidden;text-overflow:ellipsis;color:var(--mut)}
.activity time{color:var(--mut);font-size:12px;font-variant-numeric:tabular-nums}
.activity .av{width:22px;height:22px;font-size:11px}.t10r .av{width:19px;height:19px;font-size:10px}
.detail{position:sticky;top:74px;max-height:calc(100vh - 108px);overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:10px 20px 14px;scrollbar-width:thin}
.detail h1{font-size:23px;margin:4px 0 2px}
.lead{font-size:13.5px;line-height:1.38;margin:0 0 9px;color:var(--ink2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.back{display:none;font-weight:600;font-size:14px;margin-bottom:6px}
.tags{display:flex;gap:8px;align-items:center;font-size:13px}
.dh{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin:2px 0 4px}.dh h1{margin:0!important}
@media (min-width:1000px){.dh .by{display:none}}
.pill{display:inline-block;font-size:12px;font-weight:700;padding:2px 10px;border-radius:99px;background:var(--ac2);color:var(--ac)}
.chip{display:inline-block;white-space:nowrap;font-style:normal;font-size:12px;font-weight:700;padding:2px 10px;border-radius:99px;background:var(--chip);color:var(--mut)}
.chip.ok{background:var(--okbg);color:var(--ok)}
.chip.warn,.chip.soon{background:var(--warnbg);color:var(--warn)}
.stats{display:grid;grid-template-columns:1.35fr 1.3fr .8fr .8fr;border:1px solid var(--line);border-radius:12px;margin:0 0 10px}
.stats>div{padding:6px 14px;border-left:1px solid var(--line);min-width:0}
.stats>div:first-child{border-left:0}
.stats small,.odds small,.places small{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
.stats b{display:block;font-size:18px;font-variant-numeric:tabular-nums;white-space:nowrap}
.potbig b{font-size:26px;line-height:1.1;color:var(--ac);letter-spacing:-.03em}
.potbig em{display:block;font-style:normal;font-size:12px;color:var(--mut);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oddsrow{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;margin:0 0 10px}
.odds{flex:1 1 300px;display:flex;flex-wrap:wrap;white-space:nowrap;align-items:baseline;gap:4px 14px;margin:0;padding:5px 14px;border-radius:10px;background:var(--ac2);font-size:14px;color:var(--ink2)}
.odds small{display:inline;color:var(--ac)}
.odds b{color:var(--ink);font-variant-numeric:tabular-nums}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin:0}
.rw-grid{display:grid;grid-template-columns:minmax(0,1fr) 204px;gap:16px;align-items:start}
.rewards-box h2,.when h2,.t10h h2{font-size:16px;margin:0 0 6px}
.tline{position:relative;list-style:none;margin:0;padding:0;font-size:13px}
.tline::before{content:"";position:absolute;left:5px;top:10px;bottom:10px;width:2px;background:var(--line)}
.tline li{position:relative;display:flex;justify-content:space-between;align-items:center;gap:8px;padding-left:22px;white-space:nowrap}
.tline .st{height:25px}.tline .st b{font-weight:650}
.tline time{color:var(--mut);font-size:12.5px;font-variant-numeric:tabular-nums}
.tline .st::before{content:"";position:absolute;left:0;top:7px;width:12px;height:12px;box-sizing:border-box;border-radius:50%;border:2px solid var(--mut);background:var(--card)}
.tline .st.past::before{border-color:var(--ac);background:var(--ac)}
.tline .ph{height:21px;font-size:12px;color:var(--mut)}.tline .ph i{font-style:normal}
.tline .ph::before{content:"";position:absolute;left:5px;top:-3px;bottom:-3px;width:2px;background-image:linear-gradient(var(--mut) 50%,transparent 0);background-size:2px 6px}
.tline .ph.past::before,.tline .ph.cur::before{background:var(--ac)}
.tline .now{height:25px;margin:1px 0;padding-right:8px;border-radius:99px;background:var(--ac2);color:var(--ac)}
.tline .now time{color:var(--ac);font-weight:600}
.tline .now::before{content:"";position:absolute;left:-1px;top:5px;width:14px;height:14px;box-sizing:border-box;border-radius:50%;background:var(--ac);border:3px solid var(--card);box-shadow:0 0 0 2px var(--ac)}
.tbl{width:100%;border-collapse:collapse;font-size:14px}
.tbl th{position:sticky;top:0;background:var(--th);text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);padding:8px 10px;border-bottom:1px solid var(--line)}
.tbl td{padding:8px 10px;border-bottom:1px solid var(--line2);vertical-align:top}
.tbl tbody tr:hover{background:var(--hov)}
.rw td,.rw th{padding:2px 6px}.rw :is(td,th):first-child{padding-left:8px}.rw th{white-space:nowrap}
.rw td{vertical-align:middle;white-space:nowrap;height:20px}.rw th{padding-top:0;padding-bottom:3px;vertical-align:bottom;background:none}.rw th h2{margin:0;text-transform:none;letter-spacing:normal;color:var(--ink)}.rw td small{color:var(--mut);font-size:11.5px}
.rw tfoot td{border:0;border-top:2px solid var(--line);font-weight:700}.rw tfoot b{color:var(--ac)}
.barcol{width:99%;min-width:48px}
.rbar{display:block;height:9px;min-width:3px;border-radius:9px;background:linear-gradient(90deg,var(--ac),#ec6aa0)}
.top10{margin-top:8px;border:1px solid var(--line);border-radius:12px;padding:6px 12px 4px;background:var(--bg)}
.top10 .sk{height:270px;background:repeating-linear-gradient(var(--sk) 0 19px,transparent 19px 26px)}
.t10h{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.t10r{display:grid;grid-template-columns:20px 128px minmax(0,1fr) 128px 70px;gap:8px;align-items:center;height:21.5px;border-top:1px solid var(--line);font-size:13.5px;white-space:nowrap}
.t10r>*{min-width:0;overflow:hidden;text-overflow:ellipsis}
.t10r .who{display:flex;gap:6px}.t10r .who a{overflow:hidden;text-overflow:ellipsis}
.t10r .ttl{color:var(--ink2)}
.t10r small{color:var(--mut);font-size:11.5px}
.t10c{height:20px;border-top:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--mut)}
.more{font-size:13px;font-weight:600}
.note{font-size:13px;margin:8px 0 0}
.prose{overflow-wrap:anywhere;margin-top:16px;border-top:1px solid var(--line);padding-top:12px}
.prose h3,.prose h4{margin:18px 0 6px}
.prose pre{background:var(--bg);padding:10px;border-radius:8px;overflow:auto;font-size:13px}
details{margin-top:16px;border-top:1px solid var(--line);padding-top:10px}
summary{cursor:pointer;font-weight:700;color:var(--ac)}
.win{color:var(--ok)}.gold{color:var(--warn)}
.rank{font-weight:700;color:var(--ac)}
#who{width:100%;max-width:300px;font:inherit;color:var(--ink);padding:8px 14px;border:1px solid var(--line);border-radius:99px;background:var(--bg)}
#who:focus{outline:2px solid var(--ac);background:var(--card)}
.panel{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:16px 18px}
.crumbs{font-size:14px;color:var(--mut);margin-bottom:10px}.crumbs span{margin:0 4px}
.av{display:inline-grid;place-items:center;flex:none;width:34px;height:34px;border-radius:50%;object-fit:cover;background:var(--ac2);color:var(--ac);font-weight:700}
.av.xl{width:88px;height:88px;font-size:36px}
.who{display:inline-flex;align-items:center;gap:8px}.who .av{width:26px;height:26px;font-size:13px}
.scroll{overflow:auto;max-height:560px}
.head-row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}
.lb-meta,.count{margin:0;color:var(--mut)}.count{font-size:14px}
.lb-tools{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-bottom:10px}
.lb-head{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:18px;align-items:center;margin-bottom:16px;padding:12px 16px}
.lb-head .stats{margin:0}
.places ol{display:flex;flex-wrap:wrap;gap:5px;list-style:none;margin:6px 0 0;padding:0}
.places li{font-size:13px;padding:3px 8px;border-radius:99px;background:var(--bg);border:1px solid var(--line);font-variant-numeric:tabular-nums}.places li b{color:var(--ac)}
.lbp{padding-bottom:6px}
.lbrow{display:grid;grid-template-columns:52px 170px minmax(0,1fr) 72px 120px 86px 76px 104px;gap:12px;align-items:center;height:40px;padding:0 10px;border-bottom:1px solid var(--line2);font-size:14px;white-space:nowrap}
.lbrow>*{overflow:hidden;text-overflow:ellipsis}
.lbrow:hover{background:var(--hov)}
.lbrow.house{background:var(--soonbg)}
.lbh{height:34px;background:var(--th);border-bottom:1px solid var(--line);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--mut)}
.lbh:hover{background:var(--th)}
.vscroll{height:max(320px,calc(100vh - 448px));overflow:auto;overscroll-behavior:contain;scrollbar-width:thin}
.vsizer{position:relative}
.vrows{position:absolute;top:0;left:0;right:0;will-change:transform}
.lbrow.none{display:block;text-align:center;color:var(--mut)}
.cols{display:grid;grid-template-columns:1fr 400px;gap:20px;align-items:start}
.profile{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:22px;align-items:center;margin-bottom:16px}.profile h1{margin:0}
.pwho p{margin:2px 0}.bio{max-width:60ch}
.links{display:flex;flex-wrap:wrap;gap:14px;margin:6px 0 0}
.ptotals{display:grid;grid-template-columns:repeat(3,auto);gap:10px 26px;margin:0}
.ptotals dt{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
.ptotals dd{margin:0;font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}
.ttl{max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lbrow .ttl{max-width:none}
.pays{list-style:none;margin:0;padding:0}.pays li{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--line2)}
@media (min-width:1000px){
.board{display:flex;flex-direction:column;min-height:calc(100vh - 116px)}
.activity{flex:1 0 170px}
.activity ul{flex:1 1 0;min-height:0;display:flex;flex-direction:column;flex-wrap:wrap;overflow:hidden}
.activity li{width:100%}
}
@media (max-width:999px){
#tick{display:none}
.activity li:nth-child(n+9){display:none}
.md.has-sel .board,.md:not(.has-sel) .detail{display:none}
.detail{position:static;max-height:none;overflow:visible}
.back{display:inline-block}
}
@media (max-width:860px){
header{flex-wrap:wrap;align-content:center;gap:8px 14px}form{order:9;flex-basis:100%;max-width:none}
.md{grid-template-columns:1fr}
h1{font-size:24px}
.stats{grid-template-columns:1fr 1fr}
.stats>div:nth-child(3){border-left:0}
.stats>div:nth-child(n+3){border-top:1px solid var(--line)}
.rw-grid,.cols,.lb-head{grid-template-columns:1fr}
.lbrow{grid-template-columns:44px minmax(0,1fr) 64px 72px}
.lbrow>:is(:nth-child(3),:nth-child(5),:nth-child(7),:nth-child(8)),.pe :is(th,td):is(:nth-child(2),:nth-child(3)){display:none}
.vscroll{height:max(360px,calc(100vh - 520px))}
.ttl{max-width:160px}
.profile{grid-template-columns:auto 1fr}.ptotals{grid-column:1/-1;grid-template-columns:repeat(3,1fr)}.av.xl{width:64px;height:64px}
}
@media (max-width:639px){
#live{margin-left:auto}input,#theme{min-height:44px}#theme{width:44px}
nav{position:fixed;inset:auto 0 0;padding:4px 6px;background:var(--card);border-top:1px solid var(--line)}nav>*{display:grid!important;place-items:center;flex:1;min-height:52px}
body{padding-bottom:92px}
.meter{bottom:61px;padding:4px 12px}.meter i{display:none}
nav{background:var(--hd)}
header{backdrop-filter:none;background:var(--card)}
nav{z-index:6;backdrop-filter:blur(8px)}
#who,select,.chips button,.btn{min-height:44px;min-width:44px}
#who{max-width:none}
.lbrow{grid-template-columns:34px minmax(0,1fr) 48px 80px;gap:8px;padding:0 4px}
.chips{flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}
.chips button{flex:none;padding:6px 16px;font-size:14px}
.btable{background:none;border:0;overflow:visible}
.rows{display:grid;gap:10px}
.brow{grid-template-columns:1fr 1fr;gap:10px 14px;padding:12px 14px;border:1px solid var(--line);border-left-width:3px;border-radius:12px;background:var(--card)}
.brow.bh,.hint{display:none}
.brow .bt{grid-column:1/-1}
.bt b,.bt small{white-space:normal}
.brow .num{text-align:left}
.brow>[data-l]::before{content:attr(data-l);display:block;margin-bottom:2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
.group{border-radius:10px}
.tbl td{padding:12px 10px}
.profile{gap:14px 16px;padding:16px}.ptotals{gap:12px 10px}.ptotals dd{font-size:21px}.links{gap:6px 14px}
.cols>.panel{background:none;border:0;padding:0}.cols .scroll{max-height:none;overflow:visible}
.pe,.pe tbody{display:block}.pe thead{display:none}
.pe tr{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 10px;margin-bottom:10px;padding:12px 14px;border:1px solid var(--line);border-left:3px solid var(--line);border-radius:12px;background:var(--card)}
.pe tr.paid{border-left-color:var(--ok)}
.pe td{display:block!important;padding:0!important;border:0!important;text-align:left;font-size:15px}
.pe td:first-child{grid-column:1/-1;font-weight:600}.pe td:first-child small{font-weight:400}
.pe td[data-l]::before{content:attr(data-l);display:block;margin-bottom:1px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
.pays li{padding:10px 0}
.rw td{padding:5px 6px}
.t10r{grid-template-columns:18px minmax(0,1fr) 100px 62px;height:34px}.t10r>.ttl{display:none}.t10c{height:22px}
.tline{max-width:340px}
}
`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];

export { stylesheet };
