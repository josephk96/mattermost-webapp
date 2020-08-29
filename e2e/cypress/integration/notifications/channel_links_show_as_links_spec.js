
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @notifications

import {getEmailUrl, getEmailMessageSeparator} from '../../utils';
const baseUrl = Cypress.config('baseUrl');
const mailUrl = getEmailUrl(baseUrl);

describe('Team Settings', () => {
    let testTeam;
    let otherUser;
    const channelName = 'off-topic';
    before(() => {
        cy.apiEmailTest();

        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
            cy.apiCreateUser().then(({user}) => {
                otherUser = user;
                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                });
                cy.apiLogin(otherUser);
            });

            // # As otherUser, set status to offline and logout
            cy.visit(`/${testTeam.name}/channels/off-topic`);
            cy.findByLabelText('set status').should('be.visible').click();
            cy.findByText('Offline').should('be.visible').click();
            cy.apiLogout();

            // # Login as sysadmin and go to the Off-Topic channel
            cy.apiAdminLogin();
            cy.visit(`/${testTeam.name}/channels/off-topic`);
        });
    });

    it('MM-T506 Channel links show as links in notification emails', () => {
        // # Open 'Account Settings' modal
        cy.findByLabelText('main menu').should('be.visible').click();
        cy.findByText('Account Settings').should('be.visible').click();

        // * Check that the 'Account Settings' modal was opened
        cy.get('#accountSettingsModal').should('exist').within(() => {
            cy.get('#notificationsButton').should('be.visible').click();

            // * Verify that 'Email Notifications' is set to 'Immediately'
            cy.get('#emailDesc').should('be.visible').within(() => {
                cy.findByText('Immediately').should('be.visible');
            });

            // # Close the modal
            cy.get('#accountSettingsHeader').find('button').should('be.visible').click();
        });

        // # Post a message as sysadmin that contains the channel name and otherUser's username
        cy.postMessage(`This is a message in ~${channelName} channel for @${otherUser.username}`);

        cy.task('getRecentEmail', {username: otherUser.username, mailUrl}).then((response) => {
            const messageSeparator = getEmailMessageSeparator(baseUrl);

            // * Verify that the email was properly received and has the correct output
            verifyEmailNotification(response, testTeam, testTeam.display_name, otherUser.email, messageSeparator);
        });
    });

    const verifyEmailNotification = (response, teamName, teamDisplayName, email, messageSeparator) => {
        const isoDate = new Date().toISOString().substring(0, 10);
        const {data, status} = response;

        // * Should return success status
        expect(status).to.equal(200);

        // * Verify that email is addressed to the correct user
        expect(data.to.length).to.equal(1);
        expect(data.to[0]).to.contain(email);

        // * Verify that date is current
        expect(data.date).to.contain(isoDate);

        // * Verify that the email subject is correct
        expect(data.subject).to.contain(`[Mattermost] Notification in ${testTeam.display_name}`);

        // * Verify that the email body is correct
        const bodyText = data.body.text.split(messageSeparator);
        expect(bodyText.length).to.equal(16);
        expect(bodyText[1]).to.equal('You have a new notification.');
        expect(bodyText[4]).to.equal('Channel: Off-Topic');
        expect(bodyText[5]).to.contain('@sysadmin');
        expect(bodyText[7]).to.equal(`This is a message in ~${channelName} ( ${baseUrl}/landing#/${testTeam.name}/channels/${channelName} ) channel for @${otherUser.username}`);
    };
});

