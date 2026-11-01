const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(name.split('/').some(part=>part.startsWith('.'))){res.writeHead(404).end();return;}
 let file=path.resolve(root,'.'+name);
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(file===root)file=path.join(root,'index.html');
 if(!path.extname(file)&&fs.existsSync(file+'.html'))file+='.html';
 fs.stat(file,(error,stat)=>{
  if(error||!stat.isFile()){res.writeHead(404).end('Não encontrado');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  if(req.method==='HEAD'){res.end();return;}fs.createReadStream(file).pipe(res);
 });
}).listen(4173,'127.0.0.1',()=>console.log('San Dojo: http://localhost:4173'));
