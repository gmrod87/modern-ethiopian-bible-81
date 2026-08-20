const {execFileSync}=require('child_process');
const steps=[
  'build.js',
  'postbuild-experience.js',
  'postbuild-read-aloud.js',
  'release35-postbuild.js',
  'release36-postbuild.js',
  'release37-postbuild.js',
  'release47-postbuild.js',
  'release48-postbuild.js',
  'release49-postbuild.js',
  'release50-postbuild.js',
  'release51-postbuild.js',
  'release52-postbuild.js',
  'release52b-postbuild.js',
  'release52c-postbuild.js',
  'release53-postbuild.js',
  'release54-postbuild.js',
  'release55-postbuild.js',
  'release56-postbuild.js'
];
for(const step of steps){
  console.log(`Running ${step}`);
  execFileSync(process.execPath,[step],{stdio:'inherit'});
}
