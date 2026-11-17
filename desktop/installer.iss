; Inno-Setup-Skript für HoneyThumb (Installation ohne Adminrechte, pro Benutzer:in)
; Der Registry-Eintrag WebDir nennt den Ordner der Oberfläche (für HoneyCut und „Honeys Werkstatt“).
#define AppVersion GetEnv("HT_VERSION")
#if AppVersion == ""
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{3B7AC09F-2736-43AA-AEC4-0533D500840A}
AppName=HoneyThumb
AppVersion={#AppVersion}
AppPublisher=Honey Balecta
DefaultDirName={localappdata}\Programs\HoneyThumb
DefaultGroupName=HoneyThumb
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=HoneyThumb-Setup-{#AppVersion}
SetupIconFile=honeythumb.ico
UninstallDisplayIcon={app}\HoneyThumb.exe
Compression=lzma2/normal
SolidCompression=no
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
ChangesAssociations=yes

[Languages]
Name: "de"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "Symbol auf dem Desktop anlegen"; GroupDescription: "Zusätzlich:"

[Files]
Source: "..\dist\HoneyThumb\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Oberfläche zusätzlich als offener Ordner – für HoneyCut
Source: "..\dist-web\*"; DestDir: "{app}\web"; Flags: ignoreversion recursesubdirs createallsubdirs

[Registry]
Root: HKCU; Subkey: "Software\HoneyBalecta\HoneyThumb"; ValueType: string; ValueName: "WebDir"; ValueData: "{app}\web"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\HoneyBalecta\HoneyThumb"; ValueType: string; ValueName: "Version"; ValueData: "{#AppVersion}"
Root: HKCU; Subkey: "Software\Classes\.honeythumb"; ValueType: string; ValueName: ""; ValueData: "HoneyThumb.Titelbild"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\HoneyThumb.Titelbild"; ValueType: string; ValueName: ""; ValueData: "HoneyThumb-Titelbild"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\HoneyThumb.Titelbild\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\HoneyThumb.exe,0"
Root: HKCU; Subkey: "Software\Classes\HoneyThumb.Titelbild\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\HoneyThumb.exe"" ""%1"""

[Icons]
Name: "{autoprograms}\HoneyThumb"; Filename: "{app}\HoneyThumb.exe"
Name: "{autodesktop}\HoneyThumb"; Filename: "{app}\HoneyThumb.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\HoneyThumb.exe"; Description: "HoneyThumb jetzt starten"; Flags: nowait postinstall skipifsilent
