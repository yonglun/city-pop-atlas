import fs from 'node:fs';
import {createHash} from 'node:crypto';
const path='data/catalog.json',data=JSON.parse(fs.readFileSync(path));
delete data.revision;
data.updatedAt=new Date().toISOString().slice(0,10);
data.revision='catalog-'+createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0,16);
fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');console.log(data.revision);
