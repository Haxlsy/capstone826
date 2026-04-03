(async () => {
  const base = process.env.BASE_URL || 'http://localhost:3001'
  try {
    console.log('Using base URL:', base)
    const custRes = await fetch(`${base}/api/sales/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Automated Test', contact_number: '09171234567', email: 'auto@test.local', home_address: 'Test St' })
    })
    const custJson = await custRes.json()
    console.log('Customer response status:', custRes.status)
    console.log(JSON.stringify(custJson, null, 2))
    if (!custRes.ok) process.exit(1)

    const customerId = custJson.customer?.customer_id ?? custJson.customer?.customerId ?? custJson.customer?.id
    if (!customerId) {
      console.error('No customer_id returned; aborting')
      process.exit(1)
    }

    const intakeRes = await fetch(`${base}/api/sales/intakes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        plate_number: 'TST-123',
        make: 'TestMake',
        model: 'TestModel',
        color: 'Black',
        service_name: 'Interior Detailing',
        downpayment: 100,
        balance: 500,
        payment_method: 'Cash',
        scheduled_date: new Date().toISOString().slice(0,10),
        status: 'pending'
      })
    })
    const intakeJson = await intakeRes.json()
    console.log('Intake response status:', intakeRes.status)
    console.log(JSON.stringify(intakeJson, null, 2))

    const listRes = await fetch(`${base}/api/sales/intakes`)
    const listJson = await listRes.json()
    console.log('List intakes status:', listRes.status)
    console.log('Recent intakes:', JSON.stringify(listJson?.intakes?.slice(0,5), null, 2))
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
})()
