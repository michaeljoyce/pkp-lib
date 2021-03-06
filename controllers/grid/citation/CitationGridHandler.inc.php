<?php

/**
 * @file controllers/grid/citation/CitationGridHandler.inc.php
 *
 * Copyright (c) 2000-2009 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class CitationGridHandler
 * @ingroup controllers_grid_citation
 *
 * @brief Handle citation grid requests.
 */

// import grid base classes
import('controllers.grid.GridHandler');
import('controllers.grid.DataObjectGridCellProvider');

// import citation grid specific classes
import('controllers.grid.citation.CitationGridRow');

// import validation classes
import('handler.validation.HandlerValidatorJournal');
import('handler.validation.HandlerValidatorRoles');

// filter option constants
// FIXME: Make filter options configurable.
define('CROSSREF_TEMP_ACCESS_EMAIL', 'pkp-support@sfu.ca');
define('ISBNDB_TEMP_APIKEY', '4B5GQSQ4');

class CitationGridHandler extends GridHandler {
	/** @var Article */
	var $_article;

	/**
	 * Constructor
	 */
	function CitationGridHandler() {
		parent::GridHandler();
	}

	//
	// Getters/Setters
	//
	/**
	 * @see PKPHandler::getRemoteOperations()
	 * @return array
	 */
	function getRemoteOperations() {
		return array_merge(parent::getRemoteOperations(), array('addCitation', 'importCitations', 'editCitation', 'parseCitation', 'lookupCitation', 'updateCitation', 'deleteCitation'));
	}

	/**
	 * Get the article associated with this citation grid.
	 * @return Article
	 */
	function &getArticle() {
		return $this->_article;
	}


	//
	// Overridden methods from PKPHandler
	//
	/**
	 * Validate that the user is the assigned section editor for
	 * the citation's article, or is a managing editor. Raises a
	 * fatal error if validation fails.
	 * @param $requiredContexts array
	 * @param $request PKPRequest
	 * @return boolean
	 */
	function validate($requiredContexts, $request) {
		// Retrieve the request context
		$router =& $request->getRouter();
		$journal =& $router->getContext($request);

		// Authorization and validation checks
		// 1) restricted site access
		if ( isset($journal) && $journal->getSetting('restrictSiteAccess')) {
			import('handler.validation.HandlerValidatorCustom');
			$this->addCheck(new HandlerValidatorCustom($this, false, 'Restricted site access!', null, create_function('', 'if (!Validation::isLoggedIn()) return false; else return true;')));
		}

		// 2) we need a journal
		$this->addCheck(new HandlerValidatorJournal($this, false, 'No journal in context!'));

		// 3) only editors or section editors may access
		$this->addCheck(new HandlerValidatorRoles($this, false, 'Insufficient privileges!', null, array(ROLE_ID_EDITOR, ROLE_ID_SECTION_EDITOR)));

		// Execute standard checks
		if (!parent::validate($requiredContexts, $request)) return false;

		// Retrieve and validate the article id
		$articleId =& $request->getUserVar('articleId');
		if (!is_numeric($articleId)) return false;

		// Retrieve the article associated with this citation grid
		$articleDAO =& DAORegistry::getDAO('ArticleDAO');
		$article =& $articleDAO->getArticle($articleId);

		// Article and editor validation
		if (!is_a($article, 'Article')) return false;
		if ($article->getJournalId() != $journal->getId()) return false;

		// Editors have access to all articles, section editors will be
		// checked individually.
		if (!Validation::isEditor()) {
			// Retrieve the edit assignments
			$editAssignmentDao =& DAORegistry::getDAO('EditAssignmentDAO');
			$editAssignments =& $editAssignmentDao->getEditAssignmentsByArticleId($article->getId());
			assert(is_a($editAssignments, 'DAOResultFactory'));
			$editAssignmentsArray =& $editAssignments->toArray();

			// Check whether the user is the article's editor,
			// otherwise deny access.
			$user =& $request->getUser();
			$userId = $user->getId();
			$wasFound = false;
			foreach ($editAssignmentsArray as $editAssignment) {
				if ($editAssignment->getEditorId() == $userId) {
					if ($editAssignment->getCanEdit()) $wasFound = true;
					break;
				}
			}

			if (!$wasFound) return false;
		}

		// Validation successful
		$this->_article =& $article;
		return true;
	}

	/*
	 * Configure the grid
	 * @param PKPRequest $request
	 */
	function initialize(&$request) {
		parent::initialize($request);

		// Load submission-specific translations
		Locale::requireComponents(array(LOCALE_COMPONENT_PKP_SUBMISSION));

		// Basic grid configuration
		$this->setTitle('submission.citations.grid.title');

		// Get the article id
		$article =& $this->getArticle();
		assert(is_a($article, 'Article'));
		$articleId = $article->getId();

		// Retrieve the citations associated with this article to be displayed in the grid
		$citationDao =& DAORegistry::getDAO('CitationDAO');
		$data =& $citationDao->getCitationsByAssocId(ASSOC_TYPE_ARTICLE, $articleId);
		$this->setData($data);

		// Grid actions
		$router =& $request->getRouter();
		$actionArgs = array('articleId' => $articleId);
		$this->addAction(
			new GridAction(
				'importCitations',
				GRID_ACTION_MODE_AJAX,
				GRID_ACTION_TYPE_NOTHING,
				$router->url($request, null, null, 'importCitations', null, $actionArgs),
				'submission.citations.grid.importCitations'
			)
		);
		$this->addAction(
			new GridAction(
				'addCitation',
				GRID_ACTION_MODE_MODAL,
				GRID_ACTION_TYPE_APPEND,
				$router->url($request, null, null, 'addCitation', null, $actionArgs),
				'grid.action.addItem'
			)
		);

		// Columns
		$emptyColumnActions = array();
		$cellProvider = new DataObjectGridCellProvider();
		$this->addColumn(
			new GridColumn(
				'editedCitation',
				'submission.citations.grid.editedCitation',
				$emptyColumnActions,
				'controllers/grid/gridCellInSpan.tpl',
				$cellProvider
			)
		);
	}


	//
	// Overridden methods from GridHandler
	//
	/**
	 * @see GridHandler::getRowInstance()
	 * @return CitationGridRow
	 */
	function &getRowInstance() {
		// Return a citation row
		$row = new CitationGridRow();
		return $row;
	}


	//
	// Public Citation Grid Actions
	//
	/**
	 * Import citations from the article
	 * @param $args array
	 * @param $request PKPRequest
	 * @return string
	 */
	function importCitations(&$args, &$request) {
		$article =& $this->getArticle();
		assert(is_a($article, 'Article'));

		// Delete existing citations
		$citationDAO =& DAORegistry::getDAO('CitationDAO');
		$citationDAO->deleteCitationsByAssocId(ASSOC_TYPE_ARTICLE, $article->getId());

		// (Re-)import raw citations from the article
		$rawCitationList = $article->getCitations();
		import('citation.CitationListTokenizerFilter');
		$citationTokenizer = new CitationListTokenizerFilter();
		$citationStrings = $citationTokenizer->execute($rawCitationList);

		// Instantiate and persist citations
		import('citation.Citation');
		$citations = array();
		foreach($citationStrings as $citationString) {
			$citation = new Citation($citationString);

			// Initialize the edited citation with the raw
			// citation string.
			$citation->setEditedCitation($citationString);

			// Set the article association
			$citation->setAssocType(ASSOC_TYPE_ARTICLE);
			$citation->setAssocId($article->getId());

			$citationDAO->insertCitation($citation);
			// FIXME: Database error handling.
			$citations[] = $citation;
			unset($citation);
		}
		$this->setData($citations);

		// Re-display the grid
		return $this->fetchGrid($args,$request);
	}

	/**
	 * An action to manually add a new citation
	 * @param $args array
	 * @param $request PKPRequest
	 */
	function addCitation(&$args, &$request) {
		// Calling editCitation() with an empty row id will add
		// a new citation.
		$this->editCitation($args, $request);
	}

	/**
	 * Edit a citation
	 * @param $args array
	 * @param $request PKPRequest
	 */
	function editCitation(&$args, &$request) {
		// Identify the citation to be updated
		$citation =& $this->_getCitationFromArgs($args, true);

		// Form handling
		import('controllers.grid.citation.form.CitationForm');
		$citationForm = new CitationForm($citation);
		if ($citationForm->isLocaleResubmit()) {
			$citationForm->readInputData();
		} else {
			$citationForm->initData();
		}
		$citationForm->display($request);

		// The form has already been displayed.
		return '';
	}

	/**
	 * Parse a citation
	 * @param $args array
	 * @param $request PKPRequest
	 */
	function parseCitation(&$args, &$request) {
		// Parse the requested citation
		$filterCallback = array($this, '_instantiateParserFilters');
		return $this->_filterCitation($request, $args, $filterCallback, CITATION_PARSED);
	}

	/**
	 * Citation lookup
	 * @param $args array
	 * @param $request PKPRequest
	 */
	function lookupCitation(&$args, &$request) {
		// Validate the requested citation
		$filterCallback = array($this, '_instantiateLookupFilters');
		return $this->_filterCitation($request, $args, $filterCallback, CITATION_LOOKED_UP);
	}

	/**
	 * Update a citation
	 * @param $args array
	 * @param $request PKPRequest
	 * @return string
	 */
	function updateCitation(&$args, &$request) {
		// Identify the citation to be updated
		$citation =& $this->_getCitationFromArgs($args, true);

		// Form initialization
		import('controllers.grid.citation.form.CitationForm');
		$citationForm = new CitationForm($citation);
		$citationForm->readInputData();

		// Form validation
		if ($citationForm->validate()) {
			$citationForm->execute();

			// Prepare the grid row data
			$row =& $this->getRowInstance();
			$row->setGridId($this->getId());
			$row->setId($citation->getId());
			$row->setData($citation);
			$row->initialize($request);

			// Render the row into a JSON response
			$json = new JSON('true', $this->_renderRowInternally($request, $row));
		} else {
			// Return an error
			$json = new JSON('false');
		}

		// Return the serialized JSON response
		return $json->getString();
	}

	/**
	 * Delete a citation
	 * @param $args array
	 * @param $request PKPRequest
	 * @return string
	 */
	function deleteCitation(&$args, &$request) {
		// Identify the citation to be deleted
		$citation =& $this->_getCitationFromArgs($args);

		$citationDAO = DAORegistry::getDAO('CitationDAO');
		$result = $citationDAO->deleteCitation($citation);

		if ($result) {
			$json = new JSON('true');
		} else {
			$json = new JSON('false', Locale::translate('submission.citations.grid.errorDeletingCitation'));
		}
		return $json->getString();
	}

	//
	// Private helper function
	//
	/**
	 * This will retrieve a citation object from the
	 * grids data source based on the request arguments.
	 * If no citation can be found then this will raise
	 * a fatal error.
	 * @param $args array
	 * @param $createIfMissing boolean If this is set to true
	 *  then a citation object will be instantiated if no
	 *  citation id is in the request.
	 * @return Citation
	 */
	function &_getCitationFromArgs(&$args, $createIfMissing = false) {
		// Identify the citation id and retrieve the
		// corresponding element from the grid's data source.
		if (!isset($args['citationId'])) {
			if ($createIfMissing) {
				// It seems that a new citation is being edited/updated
				import('citation.Citation');
				$citation = new Citation();
				$citation->setAssocType(ASSOC_TYPE_ARTICLE);
				$article =& $this->getArticle();
				$citation->setAssocId($article->getId());
			} else {
				fatalError('Missing citation id!');
			}
		} else {
			$citation =& $this->getRowDataElement($args['citationId']);
			if (is_null($citation)) fatalError('Invalid citation id!');
		}
		return $citation;
	}

	/**
	 * Instantiates filters that can parse a citation.
	 * FIXME: Make the filter selection configurable and retrieve
	 * filter candidates from the filter registry.
	 * @param $citation Citation
	 * @param $metadataDescription MetadataDescription
	 * @return array a list of filters and the filter input data
	 *  as the last entry in the array.
	 */
	function &_instantiateParserFilters(&$citation, &$metadataDescription) {
		// Extract the edited citation string from the citation
		$citationString = $citation->getEditedCitation();

		// Instantiate the supported parsers
		import('citation.parser.paracite.ParaciteRawCitationNlmCitationSchemaFilter');
		$paraciteFilter = new ParaciteRawCitationNlmCitationSchemaFilter();
		import('citation.parser.parscit.ParscitRawCitationNlmCitationSchemaFilter');
		$parscitFilter = new ParscitRawCitationNlmCitationSchemaFilter();
		import('citation.parser.regex.RegexRawCitationNlmCitationSchemaFilter');
		$regexFilter = new RegexRawCitationNlmCitationSchemaFilter();

		$parserFilters = array(&$paraciteFilter, &$parscitFilter, &$regexFilter, $citationString);
		return $parserFilters;
	}

	/**
	 * Instantiates filters that can validate and amend citations
	 * with information from external data sources.
	 * FIXME: Make the filter selection configurable and retrieve
	 * filter candidates from the filter registry.
	 * @param $citation Citation
	 * @param $metadataDescription MetadataDescription
	 * @return array a list of filters and the filter input data
	 *  as the last entry in the array.
	 */
	function &_instantiateLookupFilters(&$citation, &$metadataDescription) {
		// Instantiate CrossRef filter
		import('citation.lookup.crossref.CrossrefNlmCitationSchemaFilter');
		$crossrefFilter = new CrossrefNlmCitationSchemaFilter(CROSSREF_TEMP_ACCESS_EMAIL);

		// Instantiate and sequence ISBNdb filters
		import('citation.lookup.isbndb.IsbndbNlmCitationSchemaIsbnFilter');
		import('citation.lookup.isbndb.IsbndbIsbnNlmCitationSchemaFilter');
		$nlmToIsbnFilter = new IsbndbNlmCitationSchemaIsbnFilter(ISBNDB_TEMP_APIKEY);
		$isbnToNlmFilter = new IsbndbIsbnNlmCitationSchemaFilter(ISBNDB_TEMP_APIKEY);
		import('filter.GenericSequencerFilter');
		$isbndbFilter = new GenericSequencerFilter();
		$isbndbFilter->addFilter($nlmToIsbnFilter, $metadataDescription);
		$isbnSampleData = '1234567890123';
		$isbndbFilter->addFilter($isbnToNlmFilter, $isbnSampleData);

		// Instantiate the pubmed filter
		import('citation.lookup.pubmed.PubmedNlmCitationSchemaFilter');
		$pubmedFilter = new PubmedNlmCitationSchemaFilter();

		$lookupFilters = array(&$crossrefFilter, &$isbndbFilter, &$pubmedFilter, $metadataDescription);
		return $lookupFilters;
	}

	/**
	 * Identify the requested citation, call the given callback to filter
	 * it, persist it and re-display it in the citation form.
	 * @param $request PKPRequest
	 * @param $args array
	 * @param $filterCallback callable
	 * @param $citationStateAfterFiltering integer the state the citation will
	 *  be set to after the filter was executed.
	 * @return string
	 */
	function &_filterCitation(&$request, $args, &$filterCallback, $citationStateAfterFiltering) {
		// Identify the citation to be filtered
		$citation =& $this->_getCitationFromArgs($args);

		// Make sure that the citation implements the
		// meta-data schema. (We currently only support
		// NLM citation.)
		$supportedMetadataSchemas =& $citation->getSupportedMetadataSchemas();
		assert(count($supportedMetadataSchemas) == 1);
		$metadataSchema =& $supportedMetadataSchemas[0];
		assert(is_a($metadataSchema, 'NlmCitationSchema'));

		// Extract the meta-data description from the citation
		$metadataDescription =& $citation->extractMetadata($metadataSchema);

		// Let the callback build the filter network
		$filterList = call_user_func($filterCallback, $citation, $metadataDescription);

		// The last entry in the filter list is the
		// input data for the returned filters.
		$muxInputData =& array_pop($filterList);

		// Initialize the sample demux input data array.
		$sampleDemuxInputData = array();

		// Instantiate the citation multiplexer filter
		import('filter.GenericMultiplexerFilter');
		$citationMultiplexer = new GenericMultiplexerFilter();
		$nullVar = null;
		foreach($filterList as $citationFilter) {
			if ($citationFilter->supports($muxInputData, $nullVar)) {
				$citationMultiplexer->addFilter($citationFilter);
				unset($citationFilter);

				// We expect one citation description per filter
				// in the multiplexer result.
				$sampleDemuxInputData[] = &$metadataDescription;
			}
		}

		// Instantiate the citation de-multiplexer filter
		import('citation.NlmCitationDemultiplexerFilter');
		$citationDemultiplexer = new NlmCitationDemultiplexerFilter();
		$citationDemultiplexer->setOriginalCitation($citation);

		// Combine multiplexer and de-multiplexer to form the
		// final citation filter network.
		import('filter.GenericSequencerFilter');
		$citationFilterNet = new GenericSequencerFilter();
		$citationFilterNet->addFilter($citationMultiplexer, $muxInputData);
		$citationFilterNet->addFilter($citationDemultiplexer, $sampleDemuxInputData);

		// Send the input through the citation filter network.
		$filteredCitation =& $citationFilterNet->execute($muxInputData);
		if (is_null($filteredCitation)) fatalError('Citation filter error!');

		// Copy unfiltered data from the original citation to the filtered citation
		$article =& $this->getArticle();
		$filteredCitation->setId($citation->getId());
		$filteredCitation->setAssocId($article->getId());
		$filteredCitation->setAssocType(ASSOC_TYPE_ARTICLE);
		$filteredCitation->setRawCitation($citation->getRawCitation());
		$filteredCitation->setEditedCitation($citation->getEditedCitation());

		// Set the citation state
		$filteredCitation->setCitationState($citationStateAfterFiltering);

		// Persist the filtered citation
		$citationDAO =& DAORegistry::getDAO('CitationDAO');
		$citationDAO->updateCitation($filteredCitation);

		// Re-display the form
		import('controllers.grid.citation.form.CitationForm');
		$citationForm = new CitationForm($filteredCitation);
		$citationForm->initData();
		$citationForm->display($request);

		// The form has already been displayed.
		$emptyString = '';
		return $emptyString;
	}
}