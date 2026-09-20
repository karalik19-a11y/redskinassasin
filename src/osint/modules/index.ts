/**
 * TOMAHAWK OSINT ENGINE — built-in module catalogue
 * Registered by default; hosts may remove, replace or extend any of them:
 *
 *   const engine = createOsintEngine({ includeBuiltins: false });
 *   engine.register(myCustomModule).register(identifierModule);
 */

import type { OsintModule } from '../types/module';
import { identifierModules } from './identifier';
import { identityModules } from './identity';
import { telecomModules } from './telecom';
import { networkModules } from './network';
import { certificateModules } from './certificates';
import { webModules } from './web';
import { socialModules } from './social';
import { exposureModules } from './exposure';
import { cryptoModules } from './crypto';
import { screeningModules } from './sanctions';
import { registryModules } from './registries';
import { mediaModules } from './media';
import { geoModules } from './geo';
import { temporalModules } from './temporal';

export function createDefaultModules(): OsintModule[] {
  return [
    ...identifierModules,
    ...telecomModules,
    ...identityModules,
    ...networkModules,
    ...certificateModules,
    ...webModules,
    ...socialModules,
    ...exposureModules,
    ...cryptoModules,
    ...screeningModules,
    ...registryModules,
    ...mediaModules,
    ...geoModules,
    ...temporalModules,
  ];
}

export {
  identifierModules,
  identityModules,
  telecomModules,
  networkModules,
  certificateModules,
  webModules,
  socialModules,
  exposureModules,
  cryptoModules,
  screeningModules,
  registryModules,
  mediaModules,
  geoModules,
  temporalModules,
};
