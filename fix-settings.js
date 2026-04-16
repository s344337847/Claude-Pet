const fs = require('fs');
const p = 'C:/Users/Administrator/.claude/settings.json';
let c = JSON.parse(fs.readFileSync(p, 'utf8'));
c.hooks.UserPromptSubmit[0].hooks[0] = {
  type: 'command',
  command: 'node',
  args: [
    '-e',
    "require('http').request({hostname:'127.0.0.1',port:9876,path:'/v1/event/work',method:'POST'},res=>process.exit(0)).on('error',()=>process.exit(0)).end()"
  ]
};
c.hooks.Stop[0].hooks[0] = {
  type: 'command',
  command: 'node',
  args: [
    '-e',
    "require('http').request({hostname:'127.0.0.1',port:9876,path:'/v1/event/success',method:'POST'},res=>process.exit(0)).on('error',()=>process.exit(0)).end()"
  ]
};
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('Settings updated successfully.');
