import { inject } from '@angular/core';
import { HomeStore } from '../../features/home/home-store';
import { SettingsStore } from '../../features/settings/settings-store';

/** Angle mode and the real home variables for app functions (inject in an injection context). */
export function injectAppScope() {
  const home = inject(HomeStore);
  const settings = inject(SettingsStore);
  return () => {
    const variables = new Map<string, number>();
    for (const [k, v] of home.variables()) if (v.kind === 'real') variables.set(k, v.v);
    return { angle: settings.settings().angle, variables };
  };
}
