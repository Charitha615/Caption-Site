import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import NumberFlow from '@number-flow/react';
import { Check, Star, X } from 'lucide-react';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { PRICING_CURRENCY, YEARLY_SAVING_LABEL, type PricingPlan } from '../../../config/pricing';
import './Pricing.css';

interface PricingProps {
  plans: PricingPlan[];
  title?: string;
  description?: string;
  /** Small highlighted line above the description. */
  highlight?: string;
  /** Note under the cards (e.g. how to pay). */
  footnote?: React.ReactNode;
}

const money = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

/**
 * Pricing cards with a monthly / yearly switch (confetti when switching to yearly),
 * animated prices, and a raised "Popular" card. Ported from a shadcn/Tailwind block to
 * this project's plain-CSS setup; behaviour is the same.
 */
export function Pricing({
  plans,
  title = 'Simple, transparent pricing',
  description = 'Start free. Upgrade when you need more.',
  highlight,
  footnote,
}: PricingProps) {
  const [isMonthly, setIsMonthly] = useState(true);
  const isDesktop = useMediaQuery('(min-width: 900px)');
  const reduceMotion = useReducedMotion();
  const switchRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();

  const toggle = () => {
    const yearly = isMonthly;
    setIsMonthly(!isMonthly);
    if (yearly && switchRef.current && !reduceMotion) {
      const rect = switchRef.current.getBoundingClientRect();
      void confetti({
        particleCount: 50,
        spread: 60,
        origin: { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight },
        colors: ['#5B21B6', '#F97316', '#A78BFA', '#FDBA74'],
        ticks: 200,
        gravity: 1.2,
        decay: 0.94,
        startVelocity: 30,
        shapes: ['circle'],
        disableForReducedMotion: true,
      });
    }
  };

  return (
    <div className="pricing">
      <div className="pricing-head">
        <h2 className="pricing-title">{title}</h2>
        {highlight && <p className="pricing-highlight">{highlight}</p>}
        <p className="pricing-desc">{description}</p>
      </div>

      <div className="pricing-toggle">
        <span className={`pricing-toggle-label ${isMonthly ? 'is-on' : ''}`}>Monthly</span>
        <button
          ref={switchRef}
          type="button"
          role="switch"
          aria-checked={!isMonthly}
          aria-labelledby={labelId}
          className="pricing-switch"
          onClick={toggle}
        >
          <span className="pricing-switch-thumb" aria-hidden="true" />
        </button>
        <span id={labelId} className={`pricing-toggle-label ${!isMonthly ? 'is-on' : ''}`}>
          Yearly billing <span className="pricing-save">({YEARLY_SAVING_LABEL})</span>
        </span>
      </div>

      <div className="pricing-grid">
        {plans.map((plan, index) => {
          const side = index === 0 ? 'left' : index === plans.length - 1 ? 'right' : 'middle';
          const amount = isMonthly ? plan.price : plan.yearlyTotal;
          const isFree = plan.price === 0;
          return (
            <motion.article
              key={plan.key}
              initial={{ y: reduceMotion ? 0 : 50, opacity: 1 }}
              whileInView={
                isDesktop && !reduceMotion
                  ? {
                      y: plan.isPopular ? -20 : 0,
                      opacity: 1,
                      // With three cards the outer ones tuck in behind the middle; two cards stay side by side.
                      x: plans.length > 2 ? (side === 'right' ? -30 : side === 'left' ? 30 : 0) : 0,
                      scale: plans.length > 2 && side !== 'middle' ? 0.94 : 1,
                    }
                  : { y: 0, opacity: 1 }
              }
              viewport={{ once: true }}
              transition={{ duration: 1.6, type: 'spring', stiffness: 100, damping: 30, delay: 0.4, opacity: { duration: 0.5 } }}
              className={`pricing-card ${plan.isPopular ? 'is-popular' : ''} is-${side}`}
              aria-label={`${plan.name} plan`}
            >
              {plan.isPopular && (
                <div className="pricing-badge">
                  <Star size={14} aria-hidden="true" fill="currentColor" /> Popular
                </div>
              )}
              <p className="pricing-plan-name">{plan.name}</p>
              <div className="pricing-price">
                <span className="pricing-amount">
                  <NumberFlow
                    value={amount}
                    prefix={`${PRICING_CURRENCY} `}
                    format={{ maximumFractionDigits: 0 }}
                    transformTiming={{ duration: reduceMotion ? 0 : 500, easing: 'ease-out' }}
                    willChange
                  />
                </span>
                {!isFree && <span className="pricing-period">{isMonthly ? '/ month' : '/ year'}</span>}
              </div>
              <p className="pricing-billing">
                {isFree
                  ? 'free forever · no card needed'
                  : isMonthly
                    ? 'paid monthly by bank transfer'
                    : `about ${PRICING_CURRENCY} ${money(Math.round(plan.yearlyTotal / 12))} a month · paid once a year`}
              </p>

              <ul className="pricing-features">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check size={16} className="pricing-check" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
                {plan.missing?.map((item) => (
                  <li key={item} className="is-missing">
                    <X size={16} className="pricing-cross" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <hr className="pricing-rule" />

              <Link to={plan.href} className={`pricing-cta ${plan.isPopular ? 'is-primary' : ''}`}>
                {plan.buttonText}
              </Link>
              <p className="pricing-plan-desc">{plan.description}</p>
            </motion.article>
          );
        })}
      </div>

      {footnote && <p className="pricing-footnote">{footnote}</p>}
    </div>
  );
}
