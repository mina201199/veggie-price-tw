// Only the government snapshot is read here. No account data is sent to the feed.
const FEED='https://veggie-government-prices.ruru0109lee.chatgpt.site/prices-data.json';
export async function GET() {
  try {
    const response=await fetch(FEED,{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Feed unavailable');
    const data=await response.json();
    if(data.schema!==1||!Array.isArray(data.items)||!data.items.length||!/^\d{4}-\d{2}-\d{2}$/.test(data.latest)||typeof data.generatedAt!=='string')throw Error('Invalid feed');
    return Response.json(data,{headers:{'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
  } catch {
    return Response.json({error:'Price feed temporarily unavailable; use the saved snapshot'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
