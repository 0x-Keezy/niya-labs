// Legacy alias: /app used to route to the VTuber home. After the Niya Labs
// reorg, / became the landing and the VTuber lives at /companion. Redirect
// preserves any external links that still point to /app.
export async function getServerSideProps() {
  return { redirect: { destination: "/companion", permanent: true } }
}

export default function AppRedirect() {
  return null
}
