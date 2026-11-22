import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Layout } from "./components/Layout.tsx"
import { Booth } from "./pages/Booth.tsx"
import { Checkout } from "./pages/Checkout.tsx"
import { Desk } from "./pages/Desk.tsx"
import { Home } from "./pages/Home.tsx"
import { How } from "./pages/How.tsx"
import { Pay } from "./pages/Pay.tsx"
import { PreviewHome } from "./pages/PreviewHome.tsx"
import { ToName } from "./pages/ToName.tsx"
import { appBasename } from "./lib/publicUrl.ts"
import { PreviewProvider } from "./preview.tsx"

export function App() {
  return (
    <BrowserRouter basename={appBasename()}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="desk" element={<Desk />} />
          <Route path="booth" element={<Booth />} />
          <Route path="checkout/:name" element={<Checkout />} />
          <Route path="pay/:invoiceId" element={<Pay />} />
          <Route path="to/:name" element={<ToName />} />
          <Route path="how" element={<How />} />
        </Route>
        <Route path="preview" element={<PreviewProvider />}>
          <Route element={<Layout />}>
            <Route index element={<PreviewHome />} />
            <Route path="desk" element={<Desk />} />
            <Route path="booth" element={<Booth />} />
            <Route path="checkout/:name" element={<Checkout />} />
            <Route path="empty" element={<Desk />} />
            <Route path="pay/:invoiceId" element={<Pay />} />
            <Route path="to/:name" element={<ToName />} />
            <Route path="how" element={<How />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
