const {execFileSync}=require('child_process');
const fs=require('fs');
fs.rmSync('dist',{recursive:true,force:true});
fs.mkdirSync('dist',{recursive:true});
execFileSync('tar',['-xzf','native-bible-app.tar.gz','-C','dist'],{stdio:'inherit'});
console.log('Native 81-book Bible app unpacked into dist');
