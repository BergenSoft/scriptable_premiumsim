# PremiumSim data usage for scriptables
Creates a small widget to show the current data usage in relation to the current passed month.
The outer circle is the progress of the current running month and the inner circle is the data used.
The color of the inner circle changes from green to yellow to red, depending on your usage relative to the current month.

Preview:<br/>
<img src="https://github.com/BergenSoft/scriptable_premiumsim/raw/main/Preview.jpg" height="128" />


Enter your PremiumSim credentials as widget parameters in the format `username|password`.<br/>
Enter your other drillisch provider credentials as widget parameters in the format `username|password|provider`.
The `provider` could be `winsim.de` for example

If you don't want to save your credentials as widget parameter, you can also create a file in your iCloud drive.<br/>
Path: **iCloudScriptableFolder/`ScriptName`/config.json**<br/>
Add it in the following format:

    {
        "username": "username",
        "password": "password",
        "provider": "optional Entry or e.g. winsim.de"
    }

The default `ScriptName` is `PremiumSim` and the needed folder is created automatically when you run the script for the first time.

[![Download with ScriptDude](https://scriptdu.de/download.svg)](https://scriptdu.de/?name=PremiumSim&source=https%3A%2F%2Fraw.githubusercontent.com%2FBergenSoft%2Fscriptable_premiumsim%2Fmain%2Fsrc%2FPremiumSim.js&docs=https%3A%2F%2Fgithub.com%2FBergenSoft%2Fscriptable_premiumsim&color=pink&icon=broadcast-tower%3B%0A%2F%2F%20share-sheet-inputs%3A%20plain-text%3B#installation)

For easy installing and updating you can use ScriptDude. Please follow install instructions if you use it the first time.
