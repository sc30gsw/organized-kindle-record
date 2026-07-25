import { Center, Loader } from "@mantine/core";

/** ClientOnly / Suspense の共通 fallback。親の高さいっぱいに中央寄せする。 */
export function PageLoader() {
  return (
    <Center h="100%" mih={160}>
      <Loader />
    </Center>
  );
}
