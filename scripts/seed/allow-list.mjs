// Where the test seed and the UAT account script are allowed to write
// (Test_Data_Strategy.md §6): the local stack, and the dev project, which is on
// the list by name. PRODUCTION IS NEVER ON IT. Both hand-run scripts read this one
// list, so a project cannot be allowed in one place and forgotten in the other.
// Hosts are compared exactly: "fzkw….supabase.co.evil.test" is not the dev project.

export const ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'fzkwbajawfircwfzwbjg.supabase.co']

/** The host of a Supabase URL, or null when the URL is missing or not a URL. */
export function hostOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export const isAllowedHost = (host) => ALLOWED_HOSTS.includes(host)
