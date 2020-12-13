import {createHash} from 'crypto';

export default function getObjectEtag(obj: any) {
  return createHash('sha512')
    .update(JSON.stringify(obj))
    .digest('base64')
    .substr(0, 10);
}
