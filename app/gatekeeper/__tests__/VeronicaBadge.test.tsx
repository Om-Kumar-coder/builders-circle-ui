/**
 * Test Group 8 — UI ↔ API Sync
 *
 * Tests the VeronicaBadge component renders correctly
 * based on different status and score values from the API.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import VeronicaBadge from '../../../src/components/gatekeeper/VeronicaBadge';

describe('VeronicaBadge [Group 8 - UI/API Sync]', () => {
  describe('Status rendering', () => {
    test('displays PENDING status correctly', () => {
      render(<VeronicaBadge status="PENDING" score={null} />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    test('displays VALID status correctly', () => {
      render(<VeronicaBadge status="VALID" score={0.85} />);
      expect(screen.getByText('Valid')).toBeInTheDocument();
    });

    test('displays NEEDS_REVIEW status correctly', () => {
      render(<VeronicaBadge status="NEEDS_REVIEW" score={0.5} />);
      expect(screen.getByText('Needs Review')).toBeInTheDocument();
    });

    test('displays FLAGGED status correctly', () => {
      render(<VeronicaBadge status="FLAGGED" score={0.2} />);
      expect(screen.getByText('Flagged')).toBeInTheDocument();
    });

    test('displays APPROVED status correctly', () => {
      render(<VeronicaBadge status="APPROVED" score={null} />);
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    test('displays REJECTED status correctly', () => {
      render(<VeronicaBadge status="REJECTED" score={0.1} />);
      expect(screen.getByText('Rejected')).toBeInTheDocument();
    });

    test('displays SENT_BACK status correctly', () => {
      render(<VeronicaBadge status="SENT_BACK" score={null} />);
      expect(screen.getByText('Sent Back')).toBeInTheDocument();
    });
  });

  describe('Score display', () => {
    test('shows percentage when score is provided', () => {
      render(<VeronicaBadge status="PENDING" score={0.5} />);
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    test('shows 0% when score is 0', () => {
      render(<VeronicaBadge status="FLAGGED" score={0} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    test('shows 100% when score is 1', () => {
      render(<VeronicaBadge status="VALID" score={1} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    test('shows 65% when score is 0.65', () => {
      render(<VeronicaBadge status="NEEDS_REVIEW" score={0.65} />);
      expect(screen.getByText('65%')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    test('handles undefined status gracefully', () => {
      render(<VeronicaBadge status={undefined as any} score={null} />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    test('handles empty string status gracefully', () => {
      render(<VeronicaBadge status="" score={null} />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    test('handles unknown status gracefully', () => {
      render(<VeronicaBadge status="UNKNOWN" score={0.5} />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  describe('API response integration', () => {
    test('matches expected API response fields', () => {
      // The Veronica API returns { status, score, flags, notes }
      // The badge consumes status and score directly
      const apiResponse = {
        status: 'NEEDS_REVIEW' as const,
        score: 0.45,
        flags: ['description_too_short'],
        notes: 'Rule-based issues: description_too_short',
      };

      const { container } = render(
        <VeronicaBadge status={apiResponse.status} score={apiResponse.score} />
      );

      expect(screen.getByText('Needs Review')).toBeInTheDocument();
      expect(screen.getByText('45%')).toBeInTheDocument();
    });
  });
});
