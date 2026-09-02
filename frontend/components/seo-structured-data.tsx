export function SeoStructuredData() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://humbertoautoimport.com'
  const phone = process.env.NEXT_PUBLIC_PHONE_NUMBER
    ? `+${process.env.NEXT_PUBLIC_PHONE_NUMBER}`
    : '+1-809-555-0100'
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contacto@humbertoautoimport.com'
  const address = process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || 'Santo Domingo, República Dominicana'
  const instagram = process.env.NEXT_PUBLIC_INSTAGRAM_URL
  const tiktok = process.env.NEXT_PUBLIC_TIKTOK_URL
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_LINK
  const mapsUrl = process.env.NEXT_PUBLIC_GOOGLE_MAPS_URL

  const socialLinks = [instagram, tiktok, whatsapp].filter((link): link is string => Boolean(link))

  const autoDealerSchema = {
    '@context': 'https://schema.org',
    '@type': ['AutoDealer', 'AutoRental'],
    '@id': `${baseUrl}/#dealer`,
    name: 'Humberto Auto Import SRL',
    alternateName: 'Humberto Auto Import - El Que Te Monta Fácil',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    image: `${baseUrl}/og-image.png`,
    description:
      'Concesionaria líder en República Dominicana especializada en la importación directa y venta de vehículos nuevos y usados de alta gama, facilidades de financiamiento y servicio de renta de autos.',
    telephone: phone,
    email: email,
    priceRange: '$$$',
    currenciesAccepted: 'DOP, USD',
    paymentAccepted: 'Efectivo, Tarjeta de Crédito, Transferencia Bancaria, Financiamiento',
    areaServed: {
      '@type': 'Country',
      name: 'República Dominicana',
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: address,
      addressLocality: 'Santo Domingo',
      addressRegion: 'Distrito Nacional',
      postalCode: '10100',
      addressCountry: 'DO',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: '18.4861',
      longitude: '-69.9312',
    },
    ...(mapsUrl ? { hasMap: mapsUrl } : {}),
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '19:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday'],
        opens: '09:00',
        closes: '17:00',
      },
    ],
    sameAs: socialLinks.length > 0 ? socialLinks : [
      'https://www.instagram.com',
      'https://www.tiktok.com'
    ],
  }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${baseUrl}/#website`,
    url: baseUrl,
    name: 'Humberto Auto Import',
    description: 'Catálogo de vehículos de alta gama en venta y renta en República Dominicana',
    publisher: {
      '@id': `${baseUrl}/#dealer`,
    },
    inLanguage: 'es-DO',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/#catalogo-section`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: '¿Qué servicios ofrece Humberto Auto Import?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Humberto Auto Import ofrece venta de vehículos importados de alta gama, servicio de renta de vehículos con reserva directa, facilidades de financiamiento bancario y garantía certificada en cada unidad.',
        },
      },
      {
        '@type': 'Question',
        name: '¿Humberto Auto Import ofrece financiamiento para la compra de vehículos?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sí, disponemos de opciones y asesoría para financiamiento con las principales entidades financieras de República Dominicana, adaptadas al presupuesto y necesidades de cada cliente.',
        },
      },
      {
        '@type': 'Question',
        name: '¿Qué garantía tienen los vehículos importados?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Todos nuestros vehículos pasan por una rigurosa inspección técnica y física de más de 150 puntos, garantizando historial verificado, cero gravámenes y documentación en regla.',
        },
      },
      {
        '@type': 'Question',
        name: '¿Cómo puedo rentar un vehículo en Humberto Auto Import?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Puedes consultar disponibilidad en tiempo real en nuestra sección de renta en línea, elegir sucursal de recogida y entrega, o contactar a nuestro equipo vía WhatsApp para una cotización personalizada.',
        },
      },
      {
        '@type': 'Question',
        name: '¿Dónde está ubicado Humberto Auto Import y cuál es su horario?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Nos encontramos en ${address}. Nuestro horario de atención es de lunes a viernes de 9:00 AM a 7:00 PM y sábados de 9:00 AM a 5:00 PM.`,
        },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(autoDealerSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  )
}
