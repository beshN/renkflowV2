# Database constraint error fix instructions

The error "Error: new row for relation 'orders' violates check constraint 'orders_status_check'" occurs because:

1. The database has a CHECK constraint on the `status` column
2. The TypeScript type allows: 'pending' | 'in_production' | 'delivered'  
3. The database enum might only allow different values

## Quick Fix:
Since the user is currently using MockOrderService (USE_DATABASE = false by default), the database error only appears when accidentally using the Neon service.

The solution is to ensure the app consistently uses MockOrderService by checking that NEXT_PUBLIC_USE_DATABASE is NOT set to 'true' in .env.local.

If the database is being used, we need to verify the database schema has the correct enum values.
