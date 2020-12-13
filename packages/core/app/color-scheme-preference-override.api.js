const {createStateAtom} = require('@start-dev/state');

const [colorSchemeOverrideOnServer, setPreferenceOverride] = createStateAtom(
  null,
);

async function setColorSchemeOverrideOnServer(mode) {
  if (mode === colorSchemeOverrideOnServer.getValue()) {
    return;
  }
  setPreferenceOverride(mode);
}

exports.colorSchemeOverrideOnServer = colorSchemeOverrideOnServer;
exports.setColorSchemeOverrideOnServer = setColorSchemeOverrideOnServer;
