!macro customUnInstall
  MessageBox MB_ICONQUESTION|MB_YESNO "Do you want to remove IdeaStudio user data (projects, assets, renders)?" IDNO keepData
    RMDir /r "$APPDATA\IdeaStudio"
  keepData:
!macroend
