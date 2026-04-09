<?php

use App\Models\App\Study;
use App\Services\Analysis\StudyStatusStateMachine;

describe('StudyStatusStateMachine::statuses', function () {
    it('returns every status key defined in the transition table', function () {
        $statuses = StudyStatusStateMachine::statuses();

        expect($statuses)->toBeArray()
            ->and($statuses)->toContain('draft')
            ->and($statuses)->toContain('protocol_development')
            ->and($statuses)->toContain('feasibility')
            ->and($statuses)->toContain('irb_review')
            ->and($statuses)->toContain('recruitment')
            ->and($statuses)->toContain('execution')
            ->and($statuses)->toContain('analysis')
            ->and($statuses)->toContain('synthesis')
            ->and($statuses)->toContain('manuscript')
            ->and($statuses)->toContain('published')
            ->and($statuses)->toContain('withdrawn')
            ->and($statuses)->toContain('archived')
            ->and($statuses)->toHaveCount(12);
    });
});

describe('StudyStatusStateMachine::allowedTransitions', function () {
    it('returns the forward transition chain for linear study phases', function () {
        expect(StudyStatusStateMachine::allowedTransitions('draft'))
            ->toContain('protocol_development')
            ->toContain('withdrawn');

        expect(StudyStatusStateMachine::allowedTransitions('protocol_development'))
            ->toContain('feasibility')
            ->toContain('draft');
    });

    it('allows only archive from the published status', function () {
        $allowed = StudyStatusStateMachine::allowedTransitions('published');

        expect($allowed)->toBe(['archived']);
    });

    it('returns an empty list for the terminal archived status', function () {
        expect(StudyStatusStateMachine::allowedTransitions('archived'))->toBe([]);
    });

    it('returns an empty list for an unknown status', function () {
        expect(StudyStatusStateMachine::allowedTransitions('not_a_real_status'))->toBe([]);
    });
});

describe('StudyStatusStateMachine::canTransition', function () {
    it('allows legal forward transitions', function () {
        expect(StudyStatusStateMachine::canTransition('draft', 'protocol_development'))->toBeTrue();
        expect(StudyStatusStateMachine::canTransition('recruitment', 'execution'))->toBeTrue();
        expect(StudyStatusStateMachine::canTransition('manuscript', 'published'))->toBeTrue();
    });

    it('allows the documented backwards-step transitions', function () {
        expect(StudyStatusStateMachine::canTransition('feasibility', 'protocol_development'))->toBeTrue();
        expect(StudyStatusStateMachine::canTransition('execution', 'recruitment'))->toBeTrue();
    });

    it('rejects illegal transitions that skip phases', function () {
        expect(StudyStatusStateMachine::canTransition('draft', 'execution'))->toBeFalse();
        expect(StudyStatusStateMachine::canTransition('draft', 'published'))->toBeFalse();
    });

    it('rejects any transition out of the terminal archived status', function () {
        expect(StudyStatusStateMachine::canTransition('archived', 'draft'))->toBeFalse();
        expect(StudyStatusStateMachine::canTransition('archived', 'published'))->toBeFalse();
        expect(StudyStatusStateMachine::canTransition('archived', 'withdrawn'))->toBeFalse();
    });

    it('allows a withdrawn study to be restored back to draft', function () {
        expect(StudyStatusStateMachine::canTransition('withdrawn', 'draft'))->toBeTrue();
    });
});

describe('StudyStatusStateMachine::phaseForStatus', function () {
    it('maps early lifecycle statuses to the pre_study phase', function () {
        expect(StudyStatusStateMachine::phaseForStatus('draft'))->toBe('pre_study');
        expect(StudyStatusStateMachine::phaseForStatus('protocol_development'))->toBe('pre_study');
        expect(StudyStatusStateMachine::phaseForStatus('feasibility'))->toBe('pre_study');
        expect(StudyStatusStateMachine::phaseForStatus('irb_review'))->toBe('pre_study');
    });

    it('maps mid-lifecycle statuses to the active phase', function () {
        expect(StudyStatusStateMachine::phaseForStatus('recruitment'))->toBe('active');
        expect(StudyStatusStateMachine::phaseForStatus('execution'))->toBe('active');
        expect(StudyStatusStateMachine::phaseForStatus('analysis'))->toBe('active');
        expect(StudyStatusStateMachine::phaseForStatus('synthesis'))->toBe('active');
    });

    it('maps late lifecycle statuses to the post_study phase', function () {
        expect(StudyStatusStateMachine::phaseForStatus('manuscript'))->toBe('post_study');
        expect(StudyStatusStateMachine::phaseForStatus('published'))->toBe('post_study');
        expect(StudyStatusStateMachine::phaseForStatus('archived'))->toBe('post_study');
    });

    it('maps withdrawn to its own phase and unknown to pre_study', function () {
        expect(StudyStatusStateMachine::phaseForStatus('withdrawn'))->toBe('withdrawn');
        expect(StudyStatusStateMachine::phaseForStatus('fabricated'))->toBe('pre_study');
    });
});

describe('StudyStatusStateMachine::transition', function () {
    it('throws InvalidArgumentException for illegal transitions before touching the DB', function () {
        // A plain Study instance with only ->status set is sufficient — the
        // exception is raised before ->save() or the activity log insert.
        $study = new Study;
        $study->status = 'draft';

        StudyStatusStateMachine::transition($study, 'published');
    })->throws(InvalidArgumentException::class, "Cannot transition study from 'draft' to 'published'");

    it('includes the list of allowed next statuses in the exception message', function () {
        $study = new Study;
        $study->status = 'recruitment';

        try {
            StudyStatusStateMachine::transition($study, 'published');
            $this->fail('Expected InvalidArgumentException was not thrown.');
        } catch (InvalidArgumentException $e) {
            expect($e->getMessage())->toContain('execution')
                ->and($e->getMessage())->toContain('irb_review')
                ->and($e->getMessage())->toContain('withdrawn');
        }
    });
});
