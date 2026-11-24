/** Conservative source assessment. Authority scores are configured hints, not truth guarantees. */
const TRUSTED_SUFFIXES=[".gov",".edu",".ac.uk",".who.int",".europa.eu"];
export function assessSource(source) {
  let url; try{url=new URL(source.url);}catch{return {accepted:false,reason:"INVALID_URL",score:0};}
  if(url.protocol!=="https:"||url.username||url.password)return {accepted:false,reason:"UNSAFE_URL",score:0};
  const host=url.hostname.toLowerCase();
  const institutional=TRUSTED_SUFFIXES.some(s=>host===s.slice(1)||host.endsWith(s));
  const publisher=String(source.publisher||"").trim().length>1;
  const hasTitle=String(source.title||"").trim().length>2;
  const score=(institutional?0.55:0.2)+(publisher?0.2:0)+(hasTitle?0.15:0)+(source.publishedAt?0.1:0);
  return {accepted:true,reason:institutional?"INSTITUTIONAL_DOMAIN_HINT":"PUBLIC_SOURCE_NEEDS_CORROBORATION",score:Math.min(1,score),institutionalHint:institutional,verified:false};
}
