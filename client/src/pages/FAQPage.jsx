import { HiOutlineQuestionMarkCircle, HiOutlineShoppingCart, HiOutlineClock, HiOutlineUserGroup } from 'react-icons/hi';
import { IoNutritionOutline } from 'react-icons/io5';

const faqGroups = [
  {
    title: 'Ordering',
    icon: HiOutlineShoppingCart,
    items: [
      {
        question: 'How do I place an order?',
        answer: 'Open the Menu page, add available items to your cart, review the quantities, and complete checkout from the Cart page.',
      },
      {
        question: 'Why did an item disappear from my cart?',
        answer: 'Cart items are reserved for a limited window so stock stays fair during rush time. If the hold expires, add the item again while it is still available.',
      },
      {
        question: 'Where can I see previous orders?',
        answer: 'Use My Orders to review active and completed orders with their current status.',
      },
    ],
  },
  {
    title: 'Queue and Pickup',
    icon: HiOutlineClock,
    items: [
      {
        question: 'What does Live Queue show?',
        answer: 'Live Queue shows menu items that currently have kitchen delay, along with the approximate waiting time.',
      },
      {
        question: 'When should I go to the canteen?',
        answer: 'Follow the order status and pickup timing shown in UniFeast. It is meant to reduce waiting near the counter.',
      },
    ],
  },
  {
    title: 'Pools',
    icon: HiOutlineUserGroup,
    items: [
      {
        question: 'What are order pools?',
        answer: 'Pools let students coordinate outside-food orders together when enough people want to join the same plan.',
      },
      {
        question: 'Can I leave a pool?',
        answer: 'Open the pool room and use the available pool controls before the pool is locked or completed.',
      },
    ],
  },
  {
    title: 'Nutrition',
    icon: IoNutritionOutline,
    items: [
      {
        question: 'Where are calories and macros shown?',
        answer: 'Menu items show quick nutrition values, and the Nutrition page gives a broader view of your eating pattern and progress.',
      },
      {
        question: 'Are nutrition numbers exact?',
        answer: 'They are useful estimates for student guidance and may vary with preparation, serving size, and ingredient changes.',
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="faq-page animate-fadeIn">
      <section className="faq-hero glass-card-static">
        <div>
          <p className="faq-kicker">Student FAQ</p>
          <h1>Quick answers for UniFeast students</h1>
          <p>Ordering, queue timing, pooled orders, and nutrition questions in one place.</p>
        </div>
        <div className="faq-hero-icon gradient-primary">
          <HiOutlineQuestionMarkCircle className="w-8 h-8 text-white" />
        </div>
      </section>

      <section className="faq-grid">
        {faqGroups.map((group) => {
          const Icon = group.icon;
          return (
            <article className="faq-group glass-card-static" key={group.title}>
              <div className="faq-group-head">
                <span>
                  <Icon className="w-5 h-5" />
                </span>
                <h2>{group.title}</h2>
              </div>

              <div className="faq-list">
                {group.items.map((item) => (
                  <details className="faq-item" key={item.question}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
