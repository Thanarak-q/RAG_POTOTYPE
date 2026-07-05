import { getCsrfToken } from '@/lib/csrf';
import { PlaygroundClient } from './playground-client';

export default async function PlaygroundPage() {
  return <PlaygroundClient csrfToken={await getCsrfToken()} />;
}
