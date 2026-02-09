# API Endpoint para Sincronización de Wishlist

## Descripción

Este documento explica cómo crear el endpoint `/api/customer-wishlist` necesario para sincronizar la lista de deseos de los clientes con el servidor.

## Flujo de Sincronización

```
1. Cliente agrega/quita producto de wishlist
   ↓
2. Se guarda en localStorage (navegador)
   ↓
3. Se envía al servidor mediante POST a /api/customer-wishlist
   ↓
4. Servidor guarda en metafield del cliente en Shopify
   ↓
5. Cuando cliente inicia sesión en otro dispositivo:
   - Se carga el wishlist desde /api/customer-wishlist (GET)
   - Se sincroniza en localStorage
```

## Implementación con Node.js + Express

### 1. Instalar dependencias

```bash
npm install express shopify-api cors dotenv
```

### 2. Crear el archivo `.env`

```
SHOPIFY_STORE_URL=tu-tienda.myshopify.com
SHOPIFY_ACCESS_TOKEN=tu-access-token
API_KEY=tu-api-key-secreto
```

### 3. Crear `api/customer-wishlist.js`

```javascript
const express = require('express');
const { shopifyApp } = require('@shopify/shopify-api');
const router = express.Router();

// POST - Guardar/actualizar wishlist
router.post('/customer-wishlist', async (req, res) => {
  try {
    const { customerId, customerEmail, wishlist } = req.body;

    if (!customerId || !wishlist) {
      return res.status(400).json({
        error: 'Faltan parámetros requeridos'
      });
    }

    // Llamar a la API de Shopify para guardar metafield
    const shopify = shopifyApp({
      apiKey: process.env.SHOPIFY_API_KEY,
      apiSecret: process.env.SHOPIFY_API_SECRET,
      scopes: process.env.SHOPIFY_API_SCOPES.split(','),
      host: process.env.SHOPIFY_APP_URL,
    });

    const client = new shopify.clients.Rest({
      session: {
        shop: process.env.SHOPIFY_STORE_URL,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
      },
    });

    // Guardar en metafield del cliente
    const response = await client.put({
      path: `customers/${customerId}.json`,
      data: {
        customer: {
          metafields: [
            {
              namespace: 'munier',
              key: 'wishlist',
              value: JSON.stringify(wishlist),
              type: 'json'
            }
          ]
        }
      }
    });

    res.json({
      success: true,
      message: 'Wishlist sincronizado',
      itemCount: wishlist.length
    });

  } catch (error) {
    console.error('Error sincronizando wishlist:', error);
    res.status(500).json({
      error: 'Error al sincronizar'
    });
  }
});

// GET - Recuperar wishlist del cliente
router.get('/customer-wishlist', async (req, res) => {
  try {
    const { customerId } = req.query;

    if (!customerId) {
      return res.status(400).json({
        error: 'customerId es requerido'
      });
    }

    const shopify = shopifyApp({
      apiKey: process.env.SHOPIFY_API_KEY,
      apiSecret: process.env.SHOPIFY_API_SECRET,
      scopes: process.env.SHOPIFY_API_SCOPES.split(','),
      host: process.env.SHOPIFY_APP_URL,
    });

    const client = new shopify.clients.Rest({
      session: {
        shop: process.env.SHOPIFY_STORE_URL,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
      },
    });

    // Obtener datos del cliente
    const response = await client.get({
      path: `customers/${customerId}.json?fields=metafields`
    });

    const wishlistMetafield = response.body.customer.metafields?.find(
      m => m.namespace === 'munier' && m.key === 'wishlist'
    );

    const wishlist = wishlistMetafield 
      ? JSON.parse(wishlistMetafield.value)
      : [];

    res.json({
      success: true,
      wishlist: wishlist,
      itemCount: wishlist.length
    });

  } catch (error) {
    console.error('Error obteniendo wishlist:', error);
    res.status(500).json({
      error: 'Error al obtener wishlist'
    });
  }
});

module.exports = router;
```

### 4. Integrar en `server.js`

```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const wishlistRouter = require('./api/customer-wishlist');

app.use(cors());
app.use(express.json());
app.use('/api', wishlistRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
```

## Alternativa: Usando Shopify Functions (Sin servidor propio)

Si prefieres no tener un servidor, puedes usar Shopify Metafields API directamente:

### 1. Crear metafield definition

```graphql
mutation {
  metafieldsSet(input: {
    ownerId: "gid://shopify/Customer/123456"
    metafields: [
      {
        namespace: "munier"
        key: "wishlist"
        type: "json"
        value: "{\"items\":[...]}"
      }
    ]
  }) {
    metafields {
      id
      namespace
      key
    }
  }
}
```

## Flujo Completo

### Cuando el usuario agrega a wishlist:
1. Se guarda en `localStorage`
2. Se envía `POST /api/customer-wishlist` con los datos
3. El servidor guarda en Shopify metafield

### Cuando el usuario inicia sesión:
1. El header detecta que `customer.id` existe
2. Envía `GET /api/customer-wishlist?customerId={{customer.id}}`
3. Recibe el wishlist del servidor
4. Se sincroniza en `localStorage`
5. Se muestra en la página de wishlist

### Sincronización automática:
- Cada 5 minutos se recarga el wishlist del servidor
- Permite sincronización entre dispositivos
- Mantiene fallback a localStorage si hay error

## Notas de Seguridad

- ✅ Validar que `customerId` coincida con el cliente autenticado
- ✅ Usar tokens de API seguros en variables de entorno
- ✅ Implementar rate limiting
- ✅ Validar datos antes de guardar

## Testing

### Probar POST (guardar wishlist):
```bash
curl -X POST http://localhost:5000/api/customer-wishlist \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "123456",
    "customerEmail": "user@example.com",
    "wishlist": [
      {
        "id": "789",
        "handle": "producto-1",
        "title": "Producto",
        "price": "$50.00"
      }
    ]
  }'
```

### Probar GET (recuperar wishlist):
```bash
curl http://localhost:5000/api/customer-wishlist?customerId=123456
```

## Variables Disponibles en Liquid

En los templates de Shopify puedes acceder a:
- `{{ customer.id }}` - ID del cliente
- `{{ customer.email }}` - Email del cliente
- `{{ customer.is_registered }}` - Si está registrado

Estos datos se usan automáticamente en los scripts de sincronización.
