import dotenv from "dotenv";
dotenv.config();

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("Error: MONGODB_URI is not defined in .env");
  process.exit(1);
}

const client = new MongoClient(uri);

async function seedDatabase() {
  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas for seeding...");

    const db = client.db("fixmate");
    const services = db.collection("services");
    const bookings = db.collection("bookings");
    const payments = db.collection("payments");

    // 1. Clean existing dummy data (services, bookings, payments only - NOT user collection)
    await services.deleteMany({});
    await bookings.deleteMany({});
    await payments.deleteMany({});
    console.log("Cleared old services, bookings, and payments.");

    // 2. Reference existing technician and customer emails (seeded via client script)
    const tech1 = {
      name: "Rahim Chowdhury",
      email: "rahim.tech@fixmate.com",
    };

    const tech2 = {
      name: "Tanvir Ahmed",
      email: "tanvir.tech@fixmate.com",
    };

    const demoCustomer = {
      name: "Shanto Customer",
      email: "shanto.customer@gmail.com",
      phone: "+8801711000004",
    };

    // 3. Seed 12 Realistic Services across ALL 7 Categories (PDF Page 4)
    const sampleServices = [
      {
        title: "AC Jet Pump Deep Cleaning & Gas Refill",
        category: "AC",
        description: "Complete indoor and outdoor unit jet-pump chemical wash, refrigerant pressure check, and cooling coil descaling with antibacterial sanitization.",
        image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80",
        basePrice: 35,
        estimatedDuration: "2 - 3 Hours",
        serviceMode: "Home Visit",
        serviceArea: "Dhaka (Mirpur, Gulshan, Dhanmondi, Uttara)",
        technicianName: tech1.name,
        technicianEmail: tech1.email,
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      },
      {
        title: "Inverter AC PCB Board & Compressor Repair",
        category: "AC",
        description: "Diagnostics and chip-level repair of inverter AC PCB boards, capacitor replacement, and heavy motor rewinding in our specialized drop-off hub.",
        image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
        basePrice: 50,
        estimatedDuration: "4 - 5 Hours",
        serviceMode: "Shop Drop-off",
        serviceArea: "Central Service Hub, Mirpur 10",
        technicianName: tech1.name,
        technicianEmail: tech1.email,
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
      },
      {
        title: "Refrigerator Cooling & Thermostat Replacement",
        category: "Refrigerator",
        description: "Rapid troubleshooting for frost buildup, warm cooling chambers, faulty start relay, overload protector replacement, and eco-friendly gas recharge.",
        image: "https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=800&q=80",
        basePrice: 30,
        estimatedDuration: "1 - 2 Hours",
        serviceMode: "Home Visit",
        serviceArea: "All over Dhaka Metropolitan",
        technicianName: tech1.name,
        technicianEmail: tech1.email,
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6),
      },
      {
        title: "Smart 4K LED TV Panel & Backlight Repair",
        category: "TV",
        description: "Professional LED backlight strip replacement, sound-no-picture troubleshooting, COF bonding, and mother board display signal calibration.",
        image: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=800&q=80",
        basePrice: 45,
        estimatedDuration: "2 - 3 Hours",
        serviceMode: "Shop Drop-off",
        serviceArea: "FixMate TV Lab, Mirpur",
        technicianName: tech1.name,
        technicianEmail: tech1.email,
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
      },
      {
        title: "Smartphone Original AMOLED Screen Replacement",
        category: "Smartphone",
        description: "Dust-free cleanroom screen replacement for iPhone, Samsung, Xiaomi & OnePlus with authentic oleophobic-coated 120Hz AMOLED panels.",
        image: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=800&q=80",
        basePrice: 40,
        estimatedDuration: "45 Minutes",
        serviceMode: "Shop Drop-off",
        serviceArea: "FixMate Lab, Dhanmondi 27",
        technicianName: tech2.name,
        technicianEmail: tech2.email,
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
      },
      {
        title: "Mobile Battery Replacement & Charging Port Fix",
        category: "Smartphone",
        description: "Original high-cycle battery replacement, fast-charging port micro-soldering, and speaker mesh ultrasonic cleaning.",
        image: "https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=800&q=80",
        basePrice: 20,
        estimatedDuration: "30 Minutes",
        serviceMode: "Home Visit",
        serviceArea: "Dhanmondi, Mohammadpur, Lalmatia",
        technicianName: tech2.name,
        technicianEmail: tech2.email,
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      },
      {
        title: "Laptop Motherboard Chip-Level Power Servicing",
        category: "Laptop & PC",
        description: "Fixing dead power rails, shorted MOSFETs, liquid-damage corrosion ultrasonic treatment, and BGA reballing for MacBook & Gaming laptops.",
        image: "https://images.unsplash.com/photo-1588508065123-287b28e013da?auto=format&fit=crop&w=800&q=80",
        basePrice: 60,
        estimatedDuration: "1 - 2 Days",
        serviceMode: "Shop Drop-off",
        serviceArea: "FixMate Tech Hub, Banani",
        technicianName: tech2.name,
        technicianEmail: tech2.email,
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8),
      },
      {
        title: "Laptop Thermal Overhaul & Fan Noise Fix",
        category: "Laptop & PC",
        description: "Arctic MX-4 premium thermal paste application, heatsink dust cleanup, thermal pad replacement, and internal diagnostic tuning.",
        image: "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?auto=format&fit=crop&w=800&q=80",
        basePrice: 25,
        estimatedDuration: "1 Hour",
        serviceMode: "Home Visit",
        serviceArea: "Uttara, Banani, Gulshan, Baridhara",
        technicianName: tech2.name,
        technicianEmail: tech2.email,
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
      },
      {
        title: "Automatic Washing Machine Drum & Motor Repair",
        category: "Washing Machine",
        description: "Front-load and top-load drum vibration dampening, carbon brush replacement, drain pump unclogging, and water intake solenoid repair.",
        image: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=800&q=80",
        basePrice: 38,
        estimatedDuration: "2 - 3 Hours",
        serviceMode: "Home Visit",
        serviceArea: "All areas across Dhaka",
        technicianName: tech1.name,
        technicianEmail: tech1.email,
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9),
      },
      {
        title: "Washing Machine Inverter Circuit Board Fix",
        category: "Washing Machine",
        description: "Resolution of digital error codes, pressure switch sensor repair, and waterproof silicone circuit potting for modern washing machines.",
        image: "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=800&q=80",
        basePrice: 32,
        estimatedDuration: "2 Hours",
        serviceMode: "Home Visit",
        serviceArea: "Mohammadpur, Mirpur, Dhanmondi",
        technicianName: tech1.name,
        technicianEmail: tech1.email,
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
      },
      {
        title: "Home Electrical Short-Circuit & Circuit Breaker Fix",
        category: "Electrical",
        description: "Troubleshooting sparking main lines, MCB trip diagnostics, earthing leakage detection, and load balancing for home distribution boards.",
        image: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80",
        basePrice: 28,
        estimatedDuration: "1 - 2 Hours",
        serviceMode: "Home Visit",
        serviceArea: "All areas across Dhaka",
        technicianName: tech1.name,
        technicianEmail: tech1.email,
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      },
      {
        title: "Smart Switch & Ceiling Fan Rewinding Service",
        category: "Electrical",
        description: "Smart WiFi touch switch installation, capacitor replacement, heavy copper wire coil rewinding, and ball bearing lubrication.",
        image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80",
        basePrice: 18,
        estimatedDuration: "1 Hour",
        serviceMode: "Shop Drop-off",
        serviceArea: "FixMate Electrical Lab, Mirpur",
        technicianName: tech1.name,
        technicianEmail: tech1.email,
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
      },
    ];

    const serviceResult = await services.insertMany(sampleServices);
    console.log(`Successfully seeded ${serviceResult.insertedCount} repair services across 7 categories.`);

    // 4. Seed sample bookings (one in each state to test Dashboard)
    const serviceIds = Object.values(serviceResult.insertedIds);

    const sampleBookings = [
      {
        serviceId: serviceIds[0].toString(),
        serviceTitle: sampleServices[0].title,
        serviceImage: sampleServices[0].image,
        category: sampleServices[0].category,
        basePrice: sampleServices[0].basePrice,
        finalAmount: sampleServices[0].basePrice,
        technicianName: sampleServices[0].technicianName,
        technicianEmail: sampleServices[0].technicianEmail,
        customerName: demoCustomer.name,
        customerEmail: demoCustomer.email,
        customerPhone: demoCustomer.phone,
        address: "House 12, Road 5, Dhanmondi, Dhaka",
        preferredDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
        timeSlot: "10:00 AM - 12:00 PM",
        problemDescription: "AC indoor unit is blowing warm air and the cooling fan makes a continuous clicking sound.",
        status: "requested",
        paymentStatus: "unpaid",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
      },
      {
        serviceId: serviceIds[2].toString(),
        serviceTitle: sampleServices[2].title,
        serviceImage: sampleServices[2].image,
        category: sampleServices[2].category,
        basePrice: sampleServices[2].basePrice,
        finalAmount: sampleServices[2].basePrice,
        technicianName: sampleServices[2].technicianName,
        technicianEmail: sampleServices[2].technicianEmail,
        customerName: demoCustomer.name,
        customerEmail: demoCustomer.email,
        customerPhone: demoCustomer.phone,
        address: "Flat 4B, Sector 7, Uttara, Dhaka",
        preferredDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
        timeSlot: "02:00 PM - 04:00 PM",
        problemDescription: "Freezer section is frosting excessively and the compressor remains extremely hot.",
        status: "accepted",
        paymentStatus: "unpaid",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      },
      {
        serviceId: serviceIds[4].toString(),
        serviceTitle: sampleServices[4].title,
        serviceImage: sampleServices[4].image,
        category: sampleServices[4].category,
        basePrice: sampleServices[4].basePrice,
        finalAmount: sampleServices[4].basePrice,
        technicianName: sampleServices[4].technicianName,
        technicianEmail: sampleServices[4].technicianEmail,
        customerName: demoCustomer.name,
        customerEmail: demoCustomer.email,
        customerPhone: demoCustomer.phone,
        address: "Block C, Bashundhara R/A, Dhaka",
        preferredDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1),
        timeSlot: "11:00 AM - 01:00 PM",
        problemDescription: "Screen glass cracked after accidental drop, vertical green lines appearing on AMOLED display.",
        status: "in-progress",
        paymentStatus: "unpaid",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      },
      {
        serviceId: serviceIds[6].toString(),
        serviceTitle: sampleServices[6].title,
        serviceImage: sampleServices[6].image,
        category: sampleServices[6].category,
        basePrice: sampleServices[6].basePrice,
        finalAmount: 60,
        technicianName: sampleServices[6].technicianName,
        technicianEmail: sampleServices[6].technicianEmail,
        customerName: demoCustomer.name,
        customerEmail: demoCustomer.email,
        customerPhone: demoCustomer.phone,
        address: "Plot 8, Road 11, Banani, Dhaka",
        preferredDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
        timeSlot: "03:00 PM - 05:00 PM",
        problemDescription: "Laptop motherboard power rail shorted, device completely dead after coffee spill.",
        status: "completed",
        paymentStatus: "paid",
        transactionId: "pi_test_mock_seed_101",
        paidAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
        completedAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
      },
    ];

    const bookingResult = await bookings.insertMany(sampleBookings);
    console.log(`Successfully seeded ${bookingResult.insertedCount} sample bookings.`);

    // 5. Seed 1 sample payment record for the completed booking (PDF Page 5)
    const completedBooking = sampleBookings[3];
    const completedBookingId = bookingResult.insertedIds[3];

    await payments.insertOne({
      bookingId: completedBookingId.toString(),
      serviceTitle: completedBooking.serviceTitle,
      customerName: completedBooking.customerName,
      customerEmail: completedBooking.customerEmail,
      technicianName: completedBooking.technicianName,
      technicianEmail: completedBooking.technicianEmail,
      amount: completedBooking.finalAmount,
      currency: "usd",
      transactionId: completedBooking.transactionId,
      stripeSessionId: "cs_test_mock_seed_session_101",
      paymentStatus: "paid",
      paidAt: completedBooking.paidAt,
    });
    console.log("Seeded sample payment record matching PDF requirements.");

    console.log("\n=================================================");
    console.log(" Database Seeding (Services & Bookings) Completed!");
    console.log("=================================================\n");
  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    await client.close();
    process.exit(0);
  }
}

seedDatabase();