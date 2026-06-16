import './globals.css'
import { AppProvider } from '@/context/AppContext'
// import Navbar from '@/components/Navbar'
import Toast from '@/components/ui/Toast'

export const metadata = {
  title: 'VA System',
  description: 'Easy resort booking system',
  manifest: '/manifest.json',
  themeColor: '#16a34a',
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <meta name="color-sheme" content="light"/>
      </head>
      <body className='bg-white text-black'>
        <AppProvider>
          {/* <Navbar /> */}
          <Toast />
          <div>
            {children}
          </div>
        </AppProvider>
      </body>
    </html>
  )
}