// Run after the existing MOA fetch pipeline. Does not fetch or invent prices.
const fs=require('node:fs'),path=require('node:path'),P=require('./prices-core.js');
const root=path.resolve(__dirname,'..');
const today=process.argv[2]||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const raw={};
for(const file of fs.readdirSync(path.join(root,'data/raw')).filter(x=>/^\d{4}-\d{2}\.json$/.test(x)).sort()){
  const month=JSON.parse(fs.readFileSync(path.join(root,'data/raw',file),'utf8'));
  for(const [id,days] of Object.entries(month))raw[id]={...raw[id],...days};
}
const data=P.build(raw,today);data.generatedAt=new Date().toISOString();
fs.writeFileSync(path.join(__dirname,'prices-data.json'),JSON.stringify(data));
console.log(`Built ${data.items.length} varieties. Latest observation ${data.latest}; analysis date ${today}.`);
