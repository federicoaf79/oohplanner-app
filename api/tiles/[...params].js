export default async function handler(req, res) {
  const { params } = req.query
  const url = `https://tile.openstreetmap.org/${params.join('/')}`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OOHPlanner/1.0',
      }
    })

    if (!response.ok) {
      return res.status(response.status).end()
    }

    const buffer = await response.arrayBuffer()
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(Buffer.from(buffer))
  } catch (err) {
    res.status(500).end()
  }
}
