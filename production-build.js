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
  'release49-postbuild.js'
];
for(const step of steps){
  console.log(`Running ${step}`);
  execFileSync(process.execPath,[step],{stdio:'inherit'});
}
