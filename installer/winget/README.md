# Winget Manifest for Parthenon Installer

This manifest is for submission to the [winget-pkgs](https://github.com/microsoft/winget-pkgs) community repository.

## Submission

1. Fork [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs)
2. Copy `Acumenus.ParthenonInstaller.yaml` to:
   `manifests/a/Acumenus/ParthenonInstaller/1.0.3/Acumenus.ParthenonInstaller.yaml`
3. Submit a PR

Or use the winget-create tool:
```
winget-create submit --id Acumenus.ParthenonInstaller
```

## Testing locally

```
winget install --manifest installer/winget/
```

## Note

The installer requires WSL 2 and Docker Desktop. After `winget install`, run `parthenon-install` from a WSL terminal.
