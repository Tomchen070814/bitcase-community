import BitcaseApp from "./BitcaseApp";
import { getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <BitcaseApp
      viewer={
        user
          ? { displayName: user.displayName, email: user.email }
          : null
      }
    />
  );
}
