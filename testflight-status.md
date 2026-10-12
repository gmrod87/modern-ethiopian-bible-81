# Hobah TestFlight Status

- status: failure
- source_commit: 8caaa938e833bc7932477acf53ec4ab96538dc01
- run_id: 38237055739
- bundle_id: com.hobah.bible
- build_number: 62
- checked_at_utc: 2026-10-12T10:37:22Z

## App Store Connect upload output

Running altool at path '/Applications/Xcode_26.6.app/Contents/SharedFrameworks/ContentDelivery.framework/Resources/altool'...

2026-10-12 10:37:19.230 ERROR: [ContentDelivery.Uploader.A86C54440] 
=======================================
UPLOAD FAILED with 2 errors
=======================================
2026-10-12 10:37:19.235 ERROR: [altool.A86C54440] This bundle is invalid. The value for key CFBundleShortVersionString [1.0.0] in the Info.plist file must contain a higher version than that of the previously approved version [1.0.0]. Please find more information about CFBundleShortVersionString at https://developer.apple.com/documentation/bundleresources/information_property_list/cfbundleshortversionstring (90062) The server’s response was: ‘{
    code = 90062;
    description = "This bundle is invalid. The value for key CFBundleShortVersionString [1.0.0] in the Info.plist file must contain a higher version than that of the previously approved version [1.0.0]. Please find more information about CFBundleShortVersionString at https://developer.apple.com/documentation/bundleresources/information_property_list/cfbundleshortversionstring";
}’.
   NSUnderlyingError : A server error occurred. (-19241)
      code : 90062
      description : This bundle is invalid. The value for key CFBundleShortVersionString [1.0.0] in the Info.plist file must contain a higher version than that of the previously approved version [1.0.0]. Please find more information about CFBundleShortVersionString at https://developer.apple.com/documentation/bundleresources/information_property_list/cfbundleshortversionstring
   iris-code : 90062
Invalid Pre-Release Train. The train version '1.0.0' is closed for new build submissions (90186) The server’s response was: ‘{
    code = 90186;
    description = "Invalid Pre-Release Train. The train version '1.0.0' is closed for new build submissions";
}’.
   NSUnderlyingError : A server error occurred. (-19241)
      code : 90186
      description : Invalid Pre-Release Train. The train version '1.0.0' is closed for new build submissions
   iris-code : 90186
2026-10-12 10:37:19.238 ERROR: [altool.1011E2DB0] ExitFailure (31)
Failed to upload package.
