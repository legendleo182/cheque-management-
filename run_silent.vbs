Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get current directory
strPath = fso.GetParentFolderName(WScript.ScriptFullName)

' Ensure node is in PATH
WshShell.Environment("PROCESS").Item("PATH") = "C:\Program Files\nodejs;" & WshShell.Environment("PROCESS").Item("PATH")

' Run node server.js completely silently (0 = hide window, False = don't wait)
WshShell.CurrentDirectory = strPath
WshShell.Run "cmd /c node server.js", 0, False
