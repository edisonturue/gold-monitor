(function(){
"use strict";
console.log("[Demo] Initializing...");

// ============ NUCLEAR OPTION: Kill ALL page navigation ============
// Intercept location.replace, location.href assign, location.assign
// BEFORE any app code can call them. This runs first because mock.js loads first.
var _origReplace = window.location.replace.bind(window.location);
var _origAssign = window.location.assign.bind(window.location);
try {
  Object.defineProperty(window.location, "replace", {
    value: function(url) {
      console.warn("[Demo] Blocked location.replace('" + url + "')");
      return undefined;
    },
    writable: false, configurable: false
  });
  Object.defineProperty(window.location, "assign", {
    value: function(url) {
      console.warn("[Demo] Blocked location.assign('" + url + "')");
      return undefined;
    },
    writable: false, configurable: false
  });
  // Block href assignment (page navigation)
  var _loc = window.location;
  var _origHrefDescriptor = Object.getOwnPropertyDescriptor(window.Location.prototype, "href");
  if (_origHrefDescriptor) {
    Object.defineProperty(window.Location.prototype, "href", {
      get: function() { return _origHrefDescriptor.get.call(this); },
      set: function(val) {
        var cur = _origHrefDescriptor.get.call(this);
        // Allow hash-only changes (same page)
        if (typeof val === "string" && val.indexOf("#") === 0) {
          _origHrefDescriptor.set.call(this, val);
          return;
        }
        // Allow same-page updates that only differ in hash
        if (typeof val === "string") {
          var hashIdx = val.indexOf("#");
          var valPath = hashIdx >= 0 ? val.substring(0, hashIdx) : val;
          var curHashIdx = cur.indexOf("#");
          var curPath = curHashIdx >= 0 ? cur.substring(0, curHashIdx) : cur;
          if (valPath === curPath) {
            _origHrefDescriptor.set.call(this, val);
            return;
          }
        }
        console.warn("[Demo] Blocked location.href = '" + val + "'");
      },
      configurable: true
    });
  }
} catch(e) {
  console.warn("[Demo] Location interception failed:", e);
}

// ============ Seeded PRNG ============
var S=42;
function R(){S=(S+0x6d2b79f5)|0;var t=Math.imul(S^(S>>>15),1|S);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;}
function ri(a,b){return Math.floor(R()*(b-a+1))+a;}
function rf(a,b){return R()*(b-a)+a;}
function pk(a){return a[Math.floor(R()*a.length)];}
function ia(s){return new Date(Date.now()-s*1e3).toISOString();}
function id(n){var d=new Date();d.setDate(d.getDate()-n);return d.toISOString();}

// ============ Pre-generated data ============
var BASE=2375.5,FX=7.2420;
// K-line bars (366 days)
var I=[],D=[],p=BASE;
for(var i=365;i>=0;i--){p+=rf(-14,14);p=Math.max(1950,Math.min(2800,p));var o=p-rf(-2,2),h=Math.max(o,p)+rf(0,5),l=Math.min(o,p)-rf(0,5);var d=new Date();d.setDate(d.getDate()-i);I.push({ts:d.toISOString(),open:+o.toFixed(2),high:+h.toFixed(2),low:+l.toFixed(2),close:+p.toFixed(2),volume:ri(1e3,5e4)});}
var db=BASE*FX/31.1034768;p=db;for(i=365;i>=0;i--){p+=rf(-6,6);p=Math.max(500,Math.min(650,p));o=p-rf(-1,1);h=Math.max(o,p)+rf(0,2);l=Math.min(o,p)-rf(0,2);d=new Date();d.setDate(d.getDate()-i);D.push({ts:d.toISOString(),open:+o.toFixed(2),high:+h.toFixed(2),low:+l.toFixed(2),close:+p.toFixed(2),volume:ri(1e3,3e4)});}
// Indicators (MA/RSI/MACD computed from bar closes)
function mks(bars){var c=bars.map(function(b){return b.close;}),len=c.length;
function ma(n){var r=[];for(var i=0;i<len;i++){if(i<n-1){r.push(null);continue;}var s=0;for(var j=0;j<n;j++)s+=c[i-j];r.push(+(s/n).toFixed(2));}return r;}
function rsi(){var r=[];for(var i=0;i<len;i++){if(i<14){r.push(null);continue;}var g=0,ls=0;for(var j=i-13;j<=i;j++){var d=c[j]-c[j-1];if(d>0)g+=d;else ls-=d;}r.push(ls===0?100:+(100-100/(1+(g/14)/(ls/14))).toFixed(2));}return r;}
function macd(){function em(n){var r=[],k=2/(n+1);for(var i=0;i<len;i++){if(i<n-1){r.push(null);continue;}var v=c[i-n+1];for(var j=i-n+2;j<=i;j++)v=c[j]*k+v*(1-k);r.push(+v.toFixed(2));}return r;}
var e12=em(12),e26=em(26),m=[],sig=[],hst=[];for(var i=0;i<len;i++){if(e12[i]===null||e26[i]===null){m.push(null);sig.push(null);hst.push(null);}else{var mv=+(e12[i]-e26[i]).toFixed(2);m.push(mv);if(i<8){sig.push(null);hst.push(null);}else{var sv=m.slice(i-8,i+1).reduce(function(a,b){return a+b;},0)/9;sig.push(+sv.toFixed(2));hst.push(+(mv-sv).toFixed(2));}}}return{m:m,signal:sig,hist:hst};}
var ma5=ma(5),ma20=ma(20),ma60=ma(60),rsi14=rsi(),md=macd();return{series:{ma5:ma5,ma20:ma20,ma60:ma60,rsi14:rsi14,macd:md.m,signal:md.signal,hist:md.hist},latest:{ma5:ma5[len-1],ma20:ma20[len-1],ma60:ma60[len-1],rsi14:rsi14[len-1],macd:md.m[len-1],signal:md.signal[len-1],hist:md.hist[len-1],trend_label:ma5[len-1]>ma20[len-1]?"bullish":"bearish",confidence:72,reasons:["MA多头排列","RSI中性偏强"]}};}
var INDI=mks(I);INDI.symbol="XAUUSD";INDI.timeframe="1d";
var INDD=mks(D);INDD.symbol="AUCN";INDD.timeframe="1d";

// ============ Route handler ============
var _h={};
function reg(m,p,f){_h[m+":"+p]=f;}
function mt(m,u){var se=u.split("/").filter(Boolean);for(var k in _h){var pt=k.split(":");if(pt[0]!==m)continue;var ps=pt.slice(1).join(":").split("/").filter(Boolean);if(ps.length!==se.length)continue;var ok=true,pr={};for(var i=0;i<ps.length;i++){if(ps[i][0]===":"){pr[ps[i].slice(1)]=se[i];}else if(ps[i]!==se[i]){ok=false;break;}}if(ok)return{h:_h[k],p:pr};}return null;}
function j(d,s){return new Response(JSON.stringify(d),{status:s||200,headers:{"Content-Type":"application/json"}});}

// === Register all routes ===
reg("GET","/api/auth/bootstrap/status",function(){return j({bootstrap_required:false,email_verification_enabled:false,smtp_configured:false,code_ttl_sec:600,resend_interval_sec:60});});
reg("GET","/api/auth/status",function(){return j({bootstrap_required:false,auth_enabled:true,authenticated:true,authenticated_user:"demo",is_admin:true,email_verification_enabled:false});});
reg("GET","/api/health",function(){return j({ok:true,service:"gold-monitor",time:new Date().toISOString(),collector_running:true});});
reg("GET","/api/prices/latest",function(){S=Math.floor(Date.now()/8e3)+42;
  var ip=BASE+rf(-15,15),uc=FX+rf(-.02,.02),dp=ip*uc/31.1034768,ic=ip-rf(-6,6),dc=dp-rf(-3,3);
  return j({items:[{symbol:"XAUUSD",market:"international",price:+ip.toFixed(2),currency:"USD",unit:"盎司",timestamp:ia(ri(2,20)),source:"gold_api_xau",prev_close:+ic.toFixed(2),change:+(ip-ic).toFixed(2),change_pct:+((ip-ic)/ic*1e4).toFixed(2),high:+(ip+rf(2,8)).toFixed(2),low:+(ip-rf(2,8)).toFixed(2),age_sec:ri(2,20),freshness_status:"live",last_changed_at:ia(ri(2,20)),expected_update_sec:10},{symbol:"AUCN",market:"domestic",price:+dp.toFixed(2),currency:"CNY",unit:"克",timestamp:ia(ri(2,20)),source:"gold_api_xau",prev_close:+dc.toFixed(2),change:+(dp-dc).toFixed(2),change_pct:+((dp-dc)/dc*1e4).toFixed(2),high:+(dp+rf(1,4)).toFixed(2),low:+(dp-rf(1,4)).toFixed(2),age_sec:ri(2,20),freshness_status:"live",last_changed_at:ia(ri(2,20)),expected_update_sec:10}],spread:{spread_cny:+rf(3,12).toFixed(2),spread_pct:+rf(.3,1.5).toFixed(2)},forecast:(function(){var a=["bullish","bearish","neutral"],b=["MACD金叉","RSI中性偏强","MA多头排列","美元走弱","地缘政治","央行购金"];return{XAUUSD:{bias:pk(a),confidence:ri(55,88),reasons:[pk(b),pk(b)]},AUCN:{bias:pk(a),confidence:ri(50,85),reasons:[pk(b)]}};})(),sources:[{source_name:"gold_api_xau",symbol:"XAUUSD",status:"up",last_success_at:ia(5),last_error:null,updated_at:ia(3)},{source_name:"gold_api_xau_history_proxy",symbol:"XAUUSD",status:"up",last_success_at:ia(10),last_error:null,updated_at:ia(10)},{source_name:"gold_api_xau",symbol:"AUCN",status:"up",last_success_at:ia(5),last_error:null,updated_at:ia(3)}]});});
reg("GET","/api/kline",function(p){var s=(p&&p.symbol)||"XAUUSD",b=s==="XAUUSD"?I:D;return j({symbol:s,timeframe:"1d",range:"12m",bars:b});});
reg("GET","/api/indicators",function(p){var s=(p&&p.symbol)||"XAUUSD";return j(s==="XAUUSD"?INDI:INDD);});
reg("GET","/api/forecast/signal",function(){var f={bias:pk(["bullish","bearish","neutral"]),confidence:ri(55,88),reasons:[pk(["MACD金叉","RSI中性偏强","MA多头排列"]),pk(["美元走弱","地缘政治","央行购金"])]};return j({symbol:"XAUUSD",timeframe:"1d",bias:f.bias,confidence:f.confidence,reasons:f.reasons});});
reg("GET","/api/rules",function(){return j([{id:1,symbol:"XAUUSD",condition:"gt",threshold:2400,cooldown_sec:1800,debounce_count:2,enabled:true,indicator_filter:null,logic_operator:"and",clauses:[{type:"price",condition:"gt",threshold:2400}],state:{consecutive_hits:0,status:"idle"}},{id:2,symbol:"XAUUSD",condition:"lt",threshold:2350,cooldown_sec:3600,debounce_count:1,enabled:true,indicator_filter:null,logic_operator:"and",clauses:[{type:"price",condition:"lt",threshold:2350}],state:{consecutive_hits:2,status:"triggered"}},{id:3,symbol:"AUCN",condition:"gt",threshold:560,cooldown_sec:900,debounce_count:1,enabled:true,indicator_filter:null,logic_operator:"and",clauses:[{type:"price",condition:"gt",threshold:560}],state:{consecutive_hits:0,status:"idle"}},{id:4,symbol:"XAUUSD",condition:"range",threshold:2340,cooldown_sec:7200,debounce_count:3,enabled:false,indicator_filter:null,logic_operator:"and",clauses:[{type:"price",condition:"lt",threshold:2340},{type:"indicator",condition:"gt",threshold:30,bias:"rsi14"}],state:{consecutive_hits:1,status:"cooldown"}},{id:5,symbol:"AUCN",condition:"pct",threshold:1.5,cooldown_sec:3600,debounce_count:1,enabled:true,indicator_filter:null,logic_operator:"or",clauses:[{type:"price",condition:"pct",threshold:1.5,direction:"up"},{type:"price",condition:"pct",threshold:1,direction:"down"}],state:{consecutive_hits:0,status:"idle"}}]);});
reg("GET","/api/alerts",function(){var e=[];for(var i=1;i<=15;i++)e.push({id:i,rule_id:ri(1,4),status:pk(["triggered","recovered","triggered","recovered"]),hit_price:+rf(2340,2430).toFixed(2),hit_time:id(ri(0,30)),message_id:"m"+i,payload:null});return j(e);});
reg("GET","/api/chart/config",function(){return j({default_range:"12m",default_timeframe:"1d",default_indicators:["MA5","MA20","MA60","RSI14","MACD"],layout_modes:["split","all","intl","domestic","dual-axis"],symbols:["XAUUSD","AUCN"]});});
reg("GET","/api/yfinance/overview",function(){return j({ticker:"AAPL",period:"6mo",interval:"1d",current_price:+rf(185,210).toFixed(2),change_pct:+rf(-2,3).toFixed(2),high_52w:+rf(215,230).toFixed(2),low_52w:+rf(155,175).toFixed(2),volume:ri(4e7,8e7),market_cap:+rf(2800,3200).toFixed(2),pe_ratio:+rf(28,35).toFixed(2),dividend_yield:+rf(.4,.7).toFixed(2),history:(function(){var h=[],p=rf(185,195);for(var i=180;i>=0;i--){p+=rf(-3,3);var d=new Date();d.setDate(d.getDate()-i);h.push({date:d.toISOString().slice(0,10),close:+p.toFixed(2),volume:ri(35e6,85e6)});}return h;})()});});
reg("GET","/api/settings",function(){return j({poll_interval_sec:5,domestic_premium_cny_per_g:0,enable_console_notifications:true,wecom_webhook_configured:false,wecom_webhook_masked:"未配置",notify_on_trigger:true,notify_on_recover:true,notify_on_source:true,notify_on_heartbeat:false,notify_style:"detailed",notify_title_prefix:"",source_expected_update_sec_map:{gold_api_xau:10},basic_auth_user:"demo",basic_auth_pass_masked:"已加密保存",session_secret_configured:true,session_secret_masked:"***",auth_max_failures:10,auth_window_sec:300,auth_ban_sec:120,auth_enabled:true,session_ttl_sec:43200,smtp_host:"",smtp_port:587,smtp_user:"",smtp_pass_masked:"",smtp_from:"",smtp_use_tls:true,smtp_use_ssl:false,smtp_configured:false,bootstrap_email_verification_enabled:false,bootstrap_code_ttl_sec:600,bootstrap_code_resend_sec:60,registration_email_verification_enabled:false,user_count:2,authenticated_user:"demo",is_admin:true,deploy_host:"0.0.0.0",deploy_port:8080,deploy_timezone:"Asia/Shanghai",deploy_db_path:"/data/gold_monitor.db",restart_required_fields:["deploy_host","deploy_port","deploy_timezone"]});});
reg("GET","/api/admin/login_audit",function(){var e=[];for(var i=1;i<=20;i++)e.push({id:i,username:pk(["demo","viewer","","demo"]),result:pk(["success","success","success","failure","success"]),ip:pk(["192.168.1.100","10.0.0.5","203.0.113.42"]),reason:"",created_at:id(ri(0,14))});return j({operator:"demo",events:e});});
reg("GET","/api/admin/users",function(){return j({operator:"demo",users:[{username:"demo",email:"demo@example.com",role:"admin",enabled:true,created_at:id(60),last_login_at:ia(600)},{username:"viewer",email:"viewer@example.com",role:"viewer",enabled:true,created_at:id(30),last_login_at:ia(3600)}],enabled_admin_count:1});});
reg("GET","/api/insight/settings",function(){return j({engine:{type:"openai",model:"gpt-4o",base_url:"",api_key_masked:"***"},news:{mode:"whitelist_preferred",whitelist_domains:["cctv.com","reuters.com","bloomberg.com"],min_authoritative_articles:2},trigger:{price_change_pct:.5,window_minutes:30,max_age_sec:600},strategy:{enabled:true,direction_cooldown_min:30,max_concurrent:2,auto_trigger:true}});});
reg("GET","/api/insight/events",function(){var e=[],sum=["金价受美联储降息预期推动上涨","地缘政治风险升温推高金价","央行购金数据超预期","技术面MACD金叉","非农数据超预期美元走强","通胀数据前市场观望"],ev=[{title:"美联储纪要：可能提前降息",url:"https://reuters.com/fed-minutes",domain:"reuters.com",authoritative:true,snippet:"美联储会议纪要显示多数官员倾向于年内降息",relevance:"direct"},{title:"央行黄金储备连续五个月增加",url:"https://cctv.com/gold-reserve",domain:"cctv.com",authoritative:true,snippet:"中国人民银行5月增持黄金储备15吨",relevance:"supporting"}];for(var i=1;i<=25;i++)e.push({id:i,symbol:i%2===1?"XAUUSD":"AUCN",direction:pk(["up","down"]),change_pct:+rf(.3,2.5).toFixed(2),window_minutes:30,triggered_at:id(ri(0,14)),status:pk(["done","done","done","done","failed"]),authoritative_count:2,supplemental_count:1,confidence:pk(["high","medium","high","medium"]),confidence_reason:pk(["多源一致","信源充足","新闻覆盖充分"]),summary:pk(sum),error:null,result:{summary:pk(sum),evidence:ev,conclusion_reached:true,confidence:"high",confidence_reason:"多源一致，权威信源覆盖充分"}});return j(e);});
reg("GET","/api/insight/events/:id",function(p){return j({id:parseInt(p.id,10),symbol:"XAUUSD",direction:"up",change_pct:1.2,window_minutes:30,triggered_at:id(5),status:"done",authoritative_count:2,supplemental_count:1,confidence:"high",confidence_reason:"多源一致",summary:"金价受美联储降息预期推动上涨",error:null,result:{summary:"金价受美联储降息预期推动上涨",evidence:[{title:"美联储纪要：可能提前降息",url:"https://reuters.com/fed-minutes",domain:"reuters.com",authoritative:true,snippet:"美联储会议纪要显示多数官员倾向于年内降息",relevance:"direct"},{title:"央行黄金储备连续五个月增加",url:"https://cctv.com/gold-reserve",domain:"cctv.com",authoritative:true,snippet:"中国人民银行5月增持黄金储备15吨",relevance:"supporting"}],conclusion_reached:true,confidence:"high",confidence_reason:"多源一致，权威信源覆盖充分"}});});
reg("GET","/api/insight/events/:id/progress",function(p){return j({event_id:parseInt(p.id,10),stage:"fetching_news",progress_pct:85,message:""});});
reg("GET","/api/insight/chat/history",function(){return j({ok:true,username:"demo",limit:80,messages:[{id:100,role:"user",content:"今天金价为什么涨了？",created_at:id(1)},{id:101,role:"assistant",content:"金价上涨受美元走弱和地缘政治因素推动。美元指数下跌0.3%至103.8。",created_at:id(1)},{id:102,role:"user",content:"技术面怎么看？",created_at:id(2)},{id:103,role:"assistant",content:"日线MA5>MA20>MA60多头排列，RSI62中性偏强，MACD金叉运行良好。",created_at:id(2)}],count:4});});
// POST
reg("POST","/api/auth/change_password",function(){return j({ok:true});});
reg("POST","/api/auth/logout",function(){return j({ok:true});});
reg("POST","/api/collect/once",function(){return j({ok:true});});
reg("POST","/api/settings",function(){return j({ok:true});});
reg("POST","/api/rules",function(){return j({ok:true});});
reg("POST","/api/settings/test_notify",function(){return j({ok:true});});
reg("POST","/api/insight/settings",function(){return j({ok:true});});
reg("POST","/api/insight/trigger",function(){return j({ok:true});});
reg("POST","/api/insight/chat/history/clear",function(){return j({ok:true});});
reg("POST","/api/admin/users",function(){return j({ok:true});});
reg("POST","/api/auth/invite/create",function(){return j({ok:true,invite_code:"DEMO123"});});
reg("POST","/api/backtest/run",function(){var el=[],bl=[],e=1e4,b=1e4;for(var i=0;i<365;i++){e+=rf(-80,120);b+=rf(-30,40);el.push({date:id(364-i),value:+e.toFixed(2)});bl.push({date:id(364-i),value:+b.toFixed(2)});}return j({rule_id:1,symbol:"XAUUSD",timeframe:"1d",range:"12m",total_triggers:ri(8,20),total_recoveries:ri(5,15),equity_curve:el,baseline_curve:bl,total_return_pct:+rf(5,25).toFixed(2),baseline_return_pct:+rf(-5,12).toFixed(2),max_drawdown:+rf(3,12).toFixed(2),win_rate:ri(45,75),profit_factor:+rf(1.2,2.5).toFixed(2),trades:[]});});
reg("POST","/api/backtest/compare",function(){var r=[];for(var i=1;i<=4;i++)r.push({rule_id:i,symbol:i%2===1?"XAUUSD":"AUCN",total_triggers:ri(5,22),total_recoveries:ri(3,16),total_return_pct:+rf(-3,28).toFixed(2),baseline_return_pct:+rf(-5,12).toFixed(2),max_drawdown:+rf(2,15).toFixed(2),win_rate:ri(40,80),profit_factor:+rf(.8,3).toFixed(2)});return j({comparison:r});});
reg("POST","/api/insight/models/discover",function(){return j({ok:true,provider:"openai",models:[{id:"gpt-4o",name:"GPT-4o",owned_by:"openai"},{id:"gpt-4o-mini",name:"GPT-4o Mini",owned_by:"openai"}]});});
reg("POST","/api/insight/test_ai",function(){return j({ok:true,result:"AI连接测试成功"});});
reg("POST","/api/insight/simulate",function(){return j({ok:true,triggered:true,reason:"价格涨幅0.8%超过阈值0.5%"});});
reg("POST","/api/insight/chat",function(){return j({ok:true,reply:pk(["金价短期偏多。MACD金叉，RSI62，MA5>MA20多头排列。支撑2360阻力2400。","美联储纪要显示通胀朝2%迈进，9月降息概率65%。","央行购金：中国5月末黄金储备7280万盎司，环比增15万盎司。"]),sources:[]});});
reg("POST","/api/insight/chat/stream",function(){var txt="金价走强受：\n1. 美元指数走弱至103.8\n2. 地缘政治不确定性\n3. 技术面多头排列";var enc=new TextEncoder();return new Response(new ReadableStream({start:function(c){var i=0;!function p(){if(i>=txt.length){c.enqueue(enc.encode("data: [DONE]\n\n"));c.close();return;}c.enqueue(enc.encode("data: "+JSON.stringify({type:"delta",content:txt.slice(i,i+5)})+"\n\n"));i+=5;setTimeout(p,30);}();}}),{status:200,headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache"}});});
reg("PATCH","/api/settings",function(){return j({ok:true});});
reg("PATCH","/api/insight/settings",function(){return j({ok:true});});
reg("PATCH","/api/admin/users/:id",function(){return j({ok:true});});
reg("DELETE","/api/rules/:id",function(){return j({ok:true});});

// ============ Patch fetch ============
var _f=window.fetch;
window.fetch=function(u,i){
  var url=typeof u==="string"?u:(u.url||""),method=(i&&i.method)||"GET",path=url;
  if(typeof url!=="string"||url.indexOf("/api/")<0)return _f.call(window,u,i);
  try{var _u=new URL(url);path=_u.pathname+_u.search;}catch(e){}
  if(path.indexOf("/api/")!==0)return _f.call(window,u,i);
  var qidx=path.indexOf("?"),sp={};
  if(qidx>=0){var qs=path.slice(qidx+1);qs.split("&").forEach(function(p){var k=p.indexOf("=");if(k>0)sp[decodeURIComponent(p.slice(0,k))]=decodeURIComponent(p.slice(k+1));});}
  path=path.split("?")[0];
  var m=mt(method,path);
  if(m){Object.keys(sp).forEach(function(k){m.p[k]=sp[k];});return Promise.resolve(m.h(m.p));}
  return Promise.resolve(j({ok:true}));
};

window.__DEMO_MODE__=true;
console.log("[Demo] Mock layer ready");
})();
