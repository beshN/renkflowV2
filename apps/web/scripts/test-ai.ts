
import dotenv from 'dotenv';
import readline from 'readline';
import { getAIService } from '@/lib/services/ai.service';
import type { WorkspaceContext } from '@/lib/services/ai.service';

// Load environment variables
dotenv.config({ path: '.env.local' });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Mock context
const mockContext: WorkspaceContext = {
  totalOrders: 156,
  activeOrders: 12,
  overdueOrders: 3,
  todayDeliveries: 5,
  currentPath: '/terminal-test',
  userName: 'Admin User',
  recentTasks: [
    { title: 'Sipariş #1234 onaylandı', status: 'completed' },
    { title: 'Fatura #9988 oluşturuldu', status: 'pending' },
  ],
  upcomingDeadlines: [
    { title: 'Acil Matbaa Siparişi', dueDate: '2024-02-10' },
  ],
};

const aiService = getAIService();

console.clear();
console.log('\x1b[36m%s\x1b[0m', '==================================================');
console.log('\x1b[36m%s\x1b[0m', '   BERATIN SİKİNİN UCU AI - TERMINAL TEST MODU');
console.log('\x1b[36m%s\x1b[0m', '==================================================');
console.log('\x1b[90m%s\x1b[0m', 'Çıkmak için "exit" veya "q" yazın.\n');

// Initialize with a system greeting if needed (optional)
// But we'll just wait for user input.

const ask = () => {
  rl.question('\x1b[32mSen:\x1b[0m ', async (input) => {
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'q') {
      console.log('Görüşürüz patron! 👋');
      rl.close();
      process.exit(0);
    }

    try {
      process.stdout.write('\x1b[33mAI Yazıyor...\x1b[0m');
      
      const response = await aiService.query(input, mockContext);
      
      // Clear "AI Yazıyor..."
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

      console.log('\x1b[35mAI:\x1b[0m', response.answer);
      
      if (response.suggestions && response.suggestions.length > 0) {
        console.log('\x1b[90mÖneriler: ' + response.suggestions.join(', ') + '\x1b[0m');
      }
      console.log(''); // Empty line
    } catch (error) {
       readline.clearLine(process.stdout, 0);
       readline.cursorTo(process.stdout, 0);
       console.error('\x1b[31mHata:\x1b[0m', error instanceof Error ? error.message : error);
    }

    ask();
  });
};

// Start conversation
ask();
