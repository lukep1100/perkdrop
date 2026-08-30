import Head from "next/head";
import Link from "next/link";

export default function NotFound(){
 return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:"24px",background:"#08090e",color:"#f7f7fb",fontFamily:"Poppins,system-ui,sans-serif",textAlign:"center"}}>
  <Head><title>Drop not found | PerkDrop</title><meta name="robots" content="noindex" /></Head>
  <section>
   <p style={{color:"#b9a7ff",fontWeight:800,letterSpacing:".08em"}}>PERKDROP</p>
   <h1 style={{fontSize:"clamp(2rem,8vw,3.5rem)",margin:".25rem 0"}}>Drop not found</h1>
   <p style={{maxWidth:460,lineHeight:1.6,color:"#c8c8d0"}}>This Drop may have ended or the link is no longer available.</p>
   <p style={{display:"flex",justifyContent:"center",gap:12,flexWrap:"wrap",marginTop:28}}>
    <Link href="/" style={{padding:"12px 18px",borderRadius:12,background:"#a78bfa",color:"#08090e",fontWeight:800,textDecoration:"none"}}>Back to PerkDrop</Link>
    <Link href="/food" style={{padding:"12px 18px",borderRadius:12,border:"1px solid #454553",color:"#f7f7fb",fontWeight:800,textDecoration:"none"}}>Browse current Drops</Link>
   </p>
  </section>
 </main>;
}
