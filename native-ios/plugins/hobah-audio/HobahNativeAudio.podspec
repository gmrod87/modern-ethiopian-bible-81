Pod::Spec.new do |s|
  s.name = 'HobahNativeAudio'
  s.version = '1.0.0'
  s.summary = 'Native spoken-audio player for Hobah.'
  s.license = { :type => 'UNLICENSED' }
  s.homepage = 'https://modern-ethiopian-bible-81.vercel.app'
  s.author = 'Hobah'
  s.source = { :git => 'https://github.com/gmrod87/modern-ethiopian-bible-81.git', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.9'
end
