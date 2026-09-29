import {androidAssociation} from '../../lib/mobile-association.mjs';
export async function getServerSideProps({res}) {
  const result=androidAssociation(process.env);
  res.statusCode=result.ready?200:503;
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control',result.ready?'public, max-age=300':'no-store');
  res.end(JSON.stringify(result.document));
  return {props:{}};
}
export default function Association(){return null;}
