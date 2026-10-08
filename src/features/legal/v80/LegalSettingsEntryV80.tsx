export function LegalSettingsEntryV80(){
  const openLegal=(slug:string)=>window.dispatchEvent(new CustomEvent('spaces:open-legal',{detail:{slug}}))
  return <section data-spaces-v80-legal-settings style={{marginTop:18,padding:14,border:'1px solid rgba(255,255,255,.08)',borderRadius:12}}>
    <strong>Legal & Policies</strong>
    <p style={{fontSize:11,color:'#77717f',margin:'5px 0 10px'}}>Terms, privacy, safety, Partner Program, and beta policies.</p>
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
      <button onClick={()=>openLegal('terms')}>Terms of Service</button>
      <button onClick={()=>openLegal('privacy')}>Privacy</button>
      <button onClick={()=>openLegal('community-guidelines')}>Community Guidelines</button>
      <button onClick={()=>openLegal('partner-program')}>Partner Program</button>
      <button onClick={()=>openLegal('safety-and-enforcement')}>Safety</button>
      <a href='/tos/' onClick={e=>{e.preventDefault();openLegal('terms')}}>Open Legal Center</a>
    </div>
  </section>
}
