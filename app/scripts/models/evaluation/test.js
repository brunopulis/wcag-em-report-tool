'use strict';

angular.module('wcagReporter')
.service('evalTestModel', function(evalSampleModel,
        evalScopeModel, wcag20spec) {

    var criteria = {},
        currentUser = {},
        num = 0;

    function TestCaseAssert() {
        this.subject = [];
        this.testCase = this.testCase += (num++);
        this.result = {
            description: 'myDesc',
            outcome: 'earl:untested'
        };
    }

    TestCaseAssert.prototype = {
        '@type': 'earl:assertion',
        assertedBy: currentUser,
        subject: undefined,
        testCase: 'myTestName',
        result: undefined,
        mode: undefined,
        addNewPage: function (page) {
            this.subject.push(page);
        },
        removePage: function (i) {
            this.subject.splice(i, 1);
        },
        setSubject: function (pages) {
            var subject = [];
            this.subject = subject;
            pages.forEach(function (page) {
                if (typeof page === 'string') {
                    page = evalSampleModel.getPageById(page);    
                }
                if (typeof page === 'object') {
                    subject.push(page);
                }
            });
        }
    };

    function CriterionAssert(idref) {
        this.testRequirement = idref;
        this.hasPart = [];
        this.result = {
            outcome: 'earl:untested',
            description: ''
        };
    }

    CriterionAssert.prototype = {
        '@type': 'earl:assertion',
        testRequirement: undefined,
        assertedBy: currentUser,
        subject: '_:website',
        result: undefined,
        mode: 'manual',
        hasPart: undefined,

        addTestCaseAssertion: function (obj) {
            var key,
                tc = new TestCaseAssert();
            this.hasPart.push(tc);
            if (!obj) {
                return;
            }
            for (key in obj) {
                if (key === 'subject') {
                    tc.setSubject(obj.subject);
                } else {
                    tc[key] = obj[key];
                }
            }
        },

        /**
         * For each page in the sample, create a 
         * test case if none exists already
         */
        setCaseForEachPage: function () {
            var singlePageCases,
                self = this;

            // Find all test cases with a single page
            singlePageCases = this.hasPart
            .filter(function (assert) {
                return (angular.isArray(assert.subject) &&
                       assert.subject.length === 1);
            // Put all pages from them in singlePageCases
            }).map(function (assert) {
                return assert.subject[0];
            });

            // Select all pages, filter those not singlePageCases
            evalSampleModel.getPages()
            .filter(function (page) {
                return singlePageCases.indexOf(page) === -1;

            // Then add a test case assertion with that page
            }).forEach(function (page) {
                self.addTestCaseAssertion({
                    subject: [page]
                });
            });
        },

        getSpec: function () {
            return wcag20spec.getCriterion(this.testRequirement);
        }
    };

    return {
        criteria: criteria,

        getCritAssert: function (idref) {
            return criteria[idref];
        },

        getCriteriaSorted: function () {
            var self = this;
            return wcag20spec.getCriteria()
            .map(function (criterion) {
                    return self.criteria[criterion.uri];
            }).filter(angular.isDefined);
        },

        addCritAssert: function (result) {
            var prop,
                newCrit = Object.create(CriterionAssert.prototype);
            CriterionAssert.apply(newCrit);
            
            for (prop in result) {
                if (prop === 'hasPart') {
                    result.hasPart.forEach(
                            newCrit.addTestCaseAssertion, newCrit);
                } else {
                    newCrit[prop] = result[prop];
                }
            }
            criteria[newCrit.testRequirement] = newCrit;
        },

        updateToConformance: function () {
            var self = this;
            wcag20spec.getCriteria().forEach(function (spec) {
                if (evalScopeModel.matchConformTarget(spec.level) &&
                typeof self.criteria[spec.uri] === 'undefined') {
                    self.addCritAssert({
                        'testRequirement': spec.uri
                    });
                }
            });
            
        }

    };
});